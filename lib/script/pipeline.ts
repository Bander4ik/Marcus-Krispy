/**
 * MultiStepEngine — the DEFAULT script engine.
 *
 * Implements the client's real process: title → outline → draft (→ fact-audit
 * later), both stages on Claude Sonnet 4.6 via the model router.
 *
 *   Stage 1 (outline): step1_research.md as the system prompt + a user message
 *     built from the title using that file's INPUT TEMPLATE. The Anthropic
 *     server-side WEB SEARCH tool is enabled (the prompt REQUIRES real sources)
 *     and adaptive thinking is on. Captures the blueprint text + source URLs.
 *
 *   Stage 2 (draft): step2_script.md as the system prompt, with Stage 1's
 *     blueprint inserted into <story_structure> and the length into
 *     <story_length>. The ~1900–1950 word script is STREAMED back.
 *
 * Prompt text is loaded from channels/<id>/prompts/ by the channel loader — it
 * is never hardcoded here.
 *
 * Stage 3 (fact audit) is a READY SEAM only — see `factAudit()` below.
 */
import {
  researchAnthropic,
  streamAnthropic,
  extractText,
  extractSources,
  usageOf,
} from "@/lib/models/anthropic";
import { pickModel } from "@/lib/models/router";
import { encodeEvent } from "@/lib/script/protocol";
import {
  streamFactAudit,
  type FactAuditInput,
} from "@/lib/script/fact-audit";
import type {
  ChannelPrompts,
  OutlineResult,
  ScriptEngine,
  ScriptRequest,
  ScriptResult,
} from "@/lib/script/types";

/** Story length the client confirmed for the pipeline. */
const STORY_LENGTH = "1900–1950 words";
/** Brand-count rule from step1_research.md's INPUT TEMPLATE. */
const BRAND_COUNT = "infer from title";

/** Thrown when the channel is missing the staged pipeline prompts. */
class MissingPromptsError extends Error {
  constructor() {
    super(
      "This channel has no staged prompts (channels/<id>/prompts/). " +
        "The multi-step pipeline needs step1_research.md and step2_script.md. " +
        "Set SCRIPT_ENGINE=single-shot to use the single-shot fallback."
    );
    this.name = "MissingPromptsError";
  }
}

function requirePrompts(req: ScriptRequest): ChannelPrompts {
  const prompts = req.channel.prompts;
  if (!prompts) throw new MissingPromptsError();
  return prompts;
}

/**
 * Builds the Stage-1 user message from step1_research.md's INPUT TEMPLATE.
 * YouTube Title = the user's title; story length + brand counts as confirmed.
 *
 * Exported for unit testing; the engine uses it internally.
 */
export function buildResearchUser(title: string): string {
  return [
    "<Input>",
    `YouTube Title: ${title.trim()}`,
    `Story length: ${STORY_LENGTH}`,
    `Overpriced / worth-it brands count: ${BRAND_COUNT}`,
    "</Input>",
    // Compactness nudge (output-only). A live run produced a bloated ~6000-word
    // outline when the prompt asks for a planning skeleton. This trims verbosity
    // WITHOUT touching research depth, web search, or sources — those stay as-is.
    "Keep the blueprint COMPACT: bullets only, tight phrasing, a few short bullets per brand. Do not write prose paragraphs or essays. This is a planning skeleton, not the script.",
  ].join("\n");
}

/**
 * Fills step2_script.md's placeholders: the blueprint goes inside
 * <story_structure>…</story_structure> and the length inside
 * <story_length>…</story_length>. We replace the whole tag block so the
 * scaffold's placeholder text ("{insert blueprint}", "{{1900–1950 words}}")
 * never leaks into the request.
 *
 * IMPORTANT: the replacement is passed as a FUNCTION, not a string. The
 * Stage-1 blueprint is LLM-generated free text and can contain `$` sequences
 * ("$&", "$`", "$'", "$$", "$1"…). String.prototype.replace treats those as
 * special replacement patterns in a *string* second arg, which would silently
 * corrupt the system prompt (e.g. "$&" re-inserts the matched tag block).
 * Returning the replacement from a function inserts it verbatim — no $-escaping
 * needed and no chance of pattern injection from the model's output.
 *
 * Exported for unit testing; the engine uses it internally.
 */
export function buildDraftSystem(step2Script: string, outline: string): string {
  let system = step2Script;

  const structure = `<story_structure>\n${outline.trim()}\n</story_structure>`;
  system = system.replace(
    /<story_structure>[\s\S]*?<\/story_structure>/,
    () => structure
  );

  const length = `<story_length>\n${STORY_LENGTH}\n</story_length>`;
  system = system.replace(/<story_length>[\s\S]*?<\/story_length>/, () => length);

  return system;
}

export class MultiStepEngine implements ScriptEngine {
  /** Stage 1 — research + structure (web search + adaptive thinking). */
  async outline(req: ScriptRequest): Promise<OutlineResult> {
    const prompts = requirePrompts(req);
    const { model } = pickModel("script-writing");

    const message = await researchAnthropic({
      model,
      system: prompts.step1Research,
      user: buildResearchUser(req.title),
    });

    return {
      outline: extractText(message),
      sources: extractSources(message),
      model,
      usage: usageOf(message),
    };
  }

  /** Stage 2 — write the continuous script from the blueprint (streamed). */
  private draft(
    req: ScriptRequest,
    outline: string
  ): ReturnType<typeof streamAnthropic> {
    const prompts = requirePrompts(req);
    const { model } = pickModel("script-writing");
    const system = buildDraftSystem(prompts.step2Script, outline);
    // The blueprint is already in the system prompt; nudge the model to write.
    // The length + CTA reminders matter: with a compact outline the model can
    // otherwise stop ~10% short and soften the closing CTA. A live test showed
    // this reminder restores the full ~1900-word length and the explicit
    // comment-inviting CTA, at no extra cost (it's just the draft user turn).
    const user =
      "Write the full script now, following the structure exactly. " +
      "Hit the mandatory 1900-1950 word length (do not stop short). End with the " +
      "natural closing CTA that invites the viewer to comment about the brand they " +
      "overpaid for or feel most strongly about — woven into the narration as its " +
      "final lines, with no label.";
    return streamAnthropic({ model, system, user });
  }

  /**
   * Streaming generation for the API route. Emits NDJSON events:
   *   research start → research done (outline + sources) → draft start →
   *   token… → done. Errors become a single `error` event.
   */
  streamRun(req: ScriptRequest): Response {
    // Validate prompts up-front so a misconfigured channel fails fast with a
    // clear JSON error from the route rather than mid-stream.
    requirePrompts(req);

    const { model } = pickModel("script-writing");
    const encoder = new TextEncoder();

    // Arrow function closes over `this` lexically — no `this` aliasing.
    const pump = async (
      controller: ReadableStreamDefaultController<Uint8Array>
    ): Promise<void> => {
      const send = (line: string) => controller.enqueue(encoder.encode(line));
      try {
        // --- Stage 1: research ---
        send(
          encodeEvent({ type: "stage", stage: "research", status: "start" })
        );
        const { outline, sources } = await this.outline(req);
        send(
          encodeEvent({
            type: "stage",
            stage: "research",
            status: "done",
            outline,
            sources,
          })
        );

        // --- Stage 2: draft (streamed) ---
        send(encodeEvent({ type: "stage", stage: "draft", status: "start" }));
        const stream = this.draft(req, outline);
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
          err instanceof Error ? err.message : "Failed to generate script.";
        // Surface the error in-band so the UI can show it even mid-stream.
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
        "X-Script-Engine": "pipeline",
      },
    });
  }

  /** Non-streaming generation — for tests / batch use. */
  async run(req: ScriptRequest): Promise<ScriptResult> {
    const { outline, sources } = await this.outline(req);

    const { model } = pickModel("script-writing");
    const stream = this.draft(req, outline);
    const message = await stream.finalMessage();
    const script = extractText(message);

    return {
      script,
      model,
      usage: usageOf(message),
      outline,
      sources,
    };
  }

  /**
   * Stage 3 — FACT AUDIT (the 3-phase human-in-the-loop flow).
   *
   * Delegates to lib/script/fact-audit.ts, which runs
   * channels/<id>/prompts/fact_audit.md as the system prompt with web search +
   * extended thinking and streams the requested phase as NDJSON. The phase
   * gating (audit → confirm → rewrite → confirm → re-audit) is driven by the
   * client, which replays the running conversation each call; this method just
   * streams one phase.
   */
  factAudit(req: ScriptRequest, input: FactAuditInput): Response {
    const prompts = requirePrompts(req);
    return streamFactAudit({
      systemPrompt: prompts.factAudit,
      input,
    });
  }
}
