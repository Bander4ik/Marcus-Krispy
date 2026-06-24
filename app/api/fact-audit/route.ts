/**
 * POST /api/fact-audit — Step 3, the 3-phase human-in-the-loop fact audit.
 *
 * Flow: parse { phase, script, turns, channelId } → assertScriptRunnable() →
 * loadChannel() → streamFactAudit() → streamed text/plain Response.
 *
 * The phases are stateful but the SERVER is stateless: the client replays the
 * running conversation (the script + every prior phase) on each call, and the
 * route streams the next phase's reply. The streamed body is the same NDJSON
 * protocol as /api/script (stage `audit` markers + script tokens — see
 * lib/script/protocol.ts).
 *
 * Pre-stream failures (missing key, unknown channel, empty script, unknown
 * phase) are returned as a JSON error with a 4xx status instead.
 */
import { assertScriptRunnable, MissingEnvError } from "@/lib/env";
import { ensureAnthropicClient } from "@/lib/models/router";
import { loadChannel } from "@/lib/channels/channels";
import {
  parseFactAuditInput,
  streamFactAudit,
  FactAuditInputError,
} from "@/lib/script/fact-audit";

export const runtime = "nodejs";

interface FactAuditBody {
  channelId?: string;
  // phase / script / turns are validated by parseFactAuditInput.
  [key: string]: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: FactAuditBody;
  try {
    body = (await request.json()) as FactAuditBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channelId =
    (typeof body.channelId === "string" && body.channelId.trim()) ||
    "tennistimez";

  // Validate the audit payload (phase + script + turns) before any work.
  let input;
  try {
    input = parseFactAuditInput(body);
  } catch (err) {
    if (err instanceof FactAuditInputError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Same key as the script pipeline (web search is billed through it too).
  try {
    await assertScriptRunnable();
  } catch (err) {
    if (err instanceof MissingEnvError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Build the client with the resolved key (so a key saved in Settings is used).
  await ensureAnthropicClient();

  let channel;
  try {
    channel = await loadChannel(channelId);
  } catch {
    return Response.json(
      { error: `Unknown channel: ${channelId}` },
      { status: 400 }
    );
  }

  const factAuditPrompt = channel.prompts?.factAudit;
  if (!factAuditPrompt) {
    return Response.json(
      {
        error: `Channel ${channelId} has no fact_audit prompt (channels/${channelId}/prompts/fact_audit.md).`,
      },
      { status: 400 }
    );
  }

  try {
    return streamFactAudit({ systemPrompt: factAuditPrompt, input });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fact audit failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
