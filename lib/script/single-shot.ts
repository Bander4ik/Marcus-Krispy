/**
 * SingleShotEngine — the Phase-1 default. Title in → full script out, in one
 * streamed Anthropic call.
 *
 * Prompt assembly lives here (not in the channel files), so when Marcus delivers
 * the real TennisTimez prompt, only channels/tennistimez/system_prompt.md
 * changes — this code stays the same.
 */
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { streamAnthropic } from "@/lib/models/anthropic";
import { pickModel } from "@/lib/models/router";
import { encodeEvent } from "@/lib/script/protocol";
import type {
  ScriptEngine,
  ScriptRequest,
  ScriptResult,
} from "@/lib/script/types";

/** Builds the system block: channel persona + voice fingerprint as a labeled section. */
function buildSystem(req: ScriptRequest): string {
  const { systemPrompt, voiceFingerprint } = req.channel;
  return [
    systemPrompt.trim(),
    "",
    "## Voice reference",
    "",
    "Mimic the rhythm and texture of the donor lines below; do not copy them verbatim.",
    "",
    voiceFingerprint.trim(),
  ].join("\n");
}

/** Builds the user message: the title/idea wrapped with a clear instruction. */
function buildUser(req: ScriptRequest): string {
  return `Write the full voiceover script for this video title/idea:\n\n${req.title.trim()}`;
}

export class SingleShotEngine implements ScriptEngine {
  streamRun(req: ScriptRequest): Response {
    const { model } = pickModel("script-writing");
    const system = buildSystem(req);
    const user = buildUser(req);

    const stream = streamAnthropic({ model, system, user });

    // Speak the same NDJSON protocol as the pipeline (no research stage), so
    // the route and UI handle both engines uniformly. Single-shot just emits a
    // draft stage, then tokens, then done.
    const encoder = new TextEncoder();
    const send = (line: string) => encoder.encode(line);
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            send(encodeEvent({ type: "stage", stage: "draft", status: "start" }))
          );
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                send(encodeEvent({ type: "token", text: event.delta.text }))
              );
            }
          }
          controller.enqueue(send(encodeEvent({ type: "done" })));
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate script.";
          controller.enqueue(send(encodeEvent({ type: "error", message })));
          controller.close();
        }
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Script-Model": model,
        "X-Script-Engine": "single-shot",
      },
    });
  }

  async run(req: ScriptRequest): Promise<ScriptResult> {
    const { model } = pickModel("script-writing");
    const system = buildSystem(req);
    const user = buildUser(req);

    const stream = streamAnthropic({ model, system, user });
    const message = await stream.finalMessage();

    const script = message.content
      .map((b: ContentBlock) => (b.type === "text" ? b.text : ""))
      .join("");

    return {
      script,
      model,
      usage: {
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens,
      },
    };
  }
}
