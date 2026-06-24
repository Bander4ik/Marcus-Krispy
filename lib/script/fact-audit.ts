/**
 * FACT AUDIT (Step 3) — the human-in-the-loop, 3-phase audit.
 *
 * Runs channels/<id>/prompts/fact_audit.md as the SYSTEM prompt against Claude
 * Sonnet 4.6, with server-side WEB SEARCH and extended thinking on. The prompt
 * is a stateful, multi-turn flow that references "the TEXT directly above this
 * message", so we model it as a running conversation:
 *
 *   PHASE 1  user = the script to audit
 *            assistant = audit + rewrite proposal (claim table, issue log, …)
 *   PHASE 2  user = "confirm: rewrite"        → assistant = rewritten script only
 *   PHASE 3  user = "confirm: re-audit"       → assistant = re-audit (R-prefixed)
 *
 * The CLIENT holds the conversation state and replays the accumulated turns each
 * call, so the model always sees the script + every prior phase as context. The
 * server stays stateless: it validates the turns, builds the next user message
 * for the requested phase, and streams the model's reply.
 *
 * Conversation turns are PLAIN TEXT (the visible body of each phase). We do not
 * replay thinking / web-search tool blocks across turns — each phase re-derives
 * its own evidence — which keeps the message list simple and avoids
 * thinking-signature ordering constraints.
 *
 * The functions that shape the conversation are pure (no I/O) so they can be
 * unit-tested directly; only `streamFactAudit` touches the model + network.
 */
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { converseAnthropic } from "@/lib/models/anthropic";
import { pickModel } from "@/lib/models/router";
import { encodeEvent } from "@/lib/script/protocol";
import {
  AUDIT_PHASES,
  CONFIRM_REAUDIT,
  CONFIRM_REWRITE,
  isAuditPhase,
  normalizeTurns,
  type AuditPhase,
  type AuditTurn,
} from "@/lib/script/fact-audit-shared";

export {
  AUDIT_PHASES,
  CONFIRM_REAUDIT,
  CONFIRM_REWRITE,
  isAuditPhase,
  type AuditPhase,
  type AuditTurn,
} from "@/lib/script/fact-audit-shared";

/** What the /api/fact-audit route accepts. */
export interface FactAuditInput {
  /** Which phase to run next. */
  phase: AuditPhase;
  /** The original script to audit (Phase 1's TEXT). Always required. */
  script: string;
  /**
   * The conversation so far, as the client accumulated it (Phase-1 user +
   * assistant audit, then the gating confirmation, etc.). Empty for Phase 1.
   */
  turns?: AuditTurn[];
}

/** Thrown for malformed audit requests (empty script, unknown phase, …). */
export class FactAuditInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactAuditInputError";
  }
}

/**
 * Validates raw input and returns a normalized, trimmed FactAuditInput.
 * Pure — throws FactAuditInputError on anything the model shouldn't see.
 */
export function parseFactAuditInput(raw: unknown): FactAuditInput {
  if (!raw || typeof raw !== "object") {
    throw new FactAuditInputError("Invalid request body.");
  }
  const body = raw as Record<string, unknown>;

  if (!isAuditPhase(body.phase)) {
    throw new FactAuditInputError(
      `Unknown phase. Expected one of: ${AUDIT_PHASES.join(", ")}.`
    );
  }
  const phase = body.phase;

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) {
    throw new FactAuditInputError("No script to audit — generate one first.");
  }

  const turns = normalizeTurns(body.turns);

  // Post-Phase-1 calls must carry the prior conversation (incl. the audit), or
  // the model has nothing to rewrite / re-audit against.
  if (phase !== "audit" && turns.length === 0) {
    throw new FactAuditInputError(
      "Missing prior audit context for this phase. Run the audit first."
    );
  }

  return { phase, script, turns };
}

/**
 * Builds the Anthropic message list for the requested phase. Pure.
 *
 * - Phase 1 (audit): a single user turn = the script, framed so the model
 *   treats it as "the TEXT directly above this message" and begins Phase 1.
 * - Phase 2/3: the accumulated turns (script → audit → confirm → …) replayed
 *   verbatim. The client supplies the canonical gating confirmation as a user
 *   turn; as a safety net, if the last turn isn't already that confirmation we
 *   append it, which also guarantees the list ends on a user turn.
 *
 * `turns` from the client always start with the raw script as the first user
 * turn; we re-frame that first turn so the model treats it as the TEXT.
 */
export function buildPhaseMessages(input: FactAuditInput): MessageParam[] {
  const turns = input.turns ?? [];

  if (input.phase === "audit" || turns.length === 0) {
    return [{ role: "user", content: framedScript(input.script) }];
  }

  const messages: MessageParam[] = turns.map((t, idx) => ({
    role: t.role,
    // Re-frame the opening user turn (the script) as the auditable TEXT.
    content: idx === 0 && t.role === "user" ? framedScript(t.text) : t.text,
  }));

  // Safety net: ensure the gating confirmation is the final user turn.
  const confirm =
    input.phase === "rewrite" ? CONFIRM_REWRITE : CONFIRM_REAUDIT;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    messages.push({ role: "user", content: confirm });
  }

  return messages;
}

/**
 * Frames the script as the auditable TEXT. The prompt expects the script
 * "directly above this message"; in an API call we put it in the first user
 * turn and tell the model to treat it as that TEXT and begin Phase 1.
 */
function framedScript(script: string): string {
  return [
    "Here is the finished script to audit. Treat everything between the",
    "<TEXT> tags as the TEXT to audit (the most recent narrative block).",
    "",
    "<TEXT>",
    script.trim(),
    "</TEXT>",
    "",
    "Begin Phase 1 now using the TEXT above.",
  ].join("\n");
}

export interface StreamFactAuditParams {
  /** fact_audit.md, used verbatim as the system prompt. */
  systemPrompt: string;
  input: FactAuditInput;
}

/**
 * Streams one audit phase as NDJSON (same protocol as the script pipeline):
 *   stage audit start → token… → done   (errors become a single `error` event).
 *
 * The model id comes from the router ("script-writing" → claude-sonnet-4-6,
 * overridable via SCRIPT_MODEL), matching the rest of the pipeline.
 */
export function streamFactAudit(params: StreamFactAuditParams): Response {
  const { systemPrompt, input } = params;
  const { model } = pickModel("script-writing");
  const messages = buildPhaseMessages(input);
  const encoder = new TextEncoder();

  const pump = async (
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> => {
    const send = (line: string) => controller.enqueue(encoder.encode(line));
    try {
      send(encodeEvent({ type: "stage", stage: "audit", status: "start" }));

      const stream = converseAnthropic({
        model,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          send(encodeEvent({ type: "token", text: event.delta.text }));
        }
      }

      send(encodeEvent({ type: "done" }));
      controller.close();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Fact audit failed.";
      send(encodeEvent({ type: "error", message }));
      controller.close();
    }
  };

  const body = new ReadableStream<Uint8Array>({
    start: (controller) => pump(controller),
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Script-Model": model,
      "X-Audit-Phase": input.phase,
    },
  });
}
