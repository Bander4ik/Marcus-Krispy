/**
 * POST /api/script — the only live API route.
 *
 * Flow: parse { title, channelId } → assertScriptRunnable() → loadChannel() →
 * getScriptEngine() → engine.streamRun() → streamed text/plain Response.
 *
 * The streamed body is newline-delimited JSON (see lib/script/protocol.ts):
 * the multi-step engine interleaves stage markers (research → draft) with the
 * streamed script tokens. Pre-stream failures (missing key, unknown channel)
 * are returned as a JSON error with a 4xx status instead.
 */
import { assertScriptRunnable, MissingEnvError } from "@/lib/env";
import { ensureAnthropicClient } from "@/lib/models/router";
import { loadChannel } from "@/lib/channels/channels";
import { getScriptEngine } from "@/lib/script/engine";

export const runtime = "nodejs";

interface ScriptBody {
  title?: string;
  channelId?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: ScriptBody;
  try {
    body = (await request.json()) as ScriptBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = body.title?.trim();
  const channelId = body.channelId?.trim() || "tennistimez";

  if (!title) {
    return Response.json(
      { error: "A title or idea is required." },
      { status: 400 }
    );
  }

  // Phase-1 only needs the Anthropic key (env, or saved via the Settings tab).
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

  try {
    const engine = getScriptEngine();
    return engine.streamRun({ title, channel });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate script.";
    return Response.json({ error: message }, { status: 500 });
  }
}
