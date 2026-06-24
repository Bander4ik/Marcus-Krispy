/**
 * Test helpers — hand-built mocks of the Anthropic SDK surface our code reads.
 *
 * The real `Message` / stream-event types carry dozens of required fields that
 * our source never touches (container, stop_details, caller, cache breakdowns,
 * …). Rather than couple every test to that internal shape, we build
 * structurally-minimal objects with exactly the fields the code reads, then cast
 * once through `unknown` to the SDK type. This keeps the mocks realistic (same
 * field names/shapes the SDK returns) without dragging in SDK-version churn.
 *
 * What the source actually reads:
 *   - message.content[]  (text blocks; web_search_tool_result blocks)
 *   - message.usage.input_tokens / output_tokens
 *   - stream is async-iterable of events; event.type === "content_block_delta"
 *     with event.delta.type === "text_delta" && event.delta.text
 *   - stream.finalMessage() → Message
 */
import type {
  Message,
  ContentBlock,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";

/** A text content block as it appears in a final Message. */
export function textBlock(text: string): ContentBlock {
  return { type: "text", text, citations: null } as unknown as ContentBlock;
}

/** One web_search_result item (lives inside a web_search_tool_result block). */
export function webResult(url: string, title?: string) {
  return {
    type: "web_search_result",
    url,
    title: title ?? "",
    page_age: null,
    encrypted_content: "enc",
  };
}

/** A web_search_tool_result block whose content is an array of results. */
export function webSearchResultBlock(
  results: Array<ReturnType<typeof webResult>>,
  toolUseId = "srvtoolu_test"
): ContentBlock {
  return {
    type: "web_search_tool_result",
    tool_use_id: toolUseId,
    content: results,
  } as unknown as ContentBlock;
}

/**
 * A web_search_tool_result ERROR block — its `content` is an object, NOT an
 * array. extractSources must skip these.
 */
export function webSearchErrorBlock(
  errorCode = "max_uses_exceeded",
  toolUseId = "srvtoolu_err"
): ContentBlock {
  return {
    type: "web_search_tool_result",
    tool_use_id: toolUseId,
    content: { type: "web_search_tool_result_error", error_code: errorCode },
  } as unknown as ContentBlock;
}

/**
 * A `thinking` content block as Sonnet 4.6 returns it in the final message when
 * thinking is on (carries a signature). extractText must NOT include its text.
 */
export function thinkingBlock(thinking: string): ContentBlock {
  return {
    type: "thinking",
    thinking,
    signature: "sig_test",
  } as unknown as ContentBlock;
}

/**
 * A `server_tool_use` block — what Claude emits to invoke the server-side web
 * search tool. It precedes the web_search_tool_result block. extractText must
 * ignore it; extractSources must ignore it (only the *result* block has URLs).
 */
export function serverToolUseBlock(
  query = "tennis brand pricing",
  toolUseId = "srvtoolu_q"
): ContentBlock {
  return {
    type: "server_tool_use",
    id: toolUseId,
    name: "web_search",
    input: { query },
  } as unknown as ContentBlock;
}

export interface MockMessageOpts {
  content?: ContentBlock[];
  inputTokens?: number;
  outputTokens?: number;
}

/** Builds a minimal-but-typed final Message with the given content/usage. */
export function mockMessage(opts: MockMessageOpts = {}): Message {
  const {
    content = [textBlock("")],
    inputTokens,
    outputTokens,
  } = opts;
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens as number,
      output_tokens: outputTokens as number,
    },
  } as unknown as Message;
}

/** A single content_block_delta / text_delta stream event carrying `text`. */
export function textDeltaEvent(text: string): RawMessageStreamEvent {
  return {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  } as unknown as RawMessageStreamEvent;
}

/** A non-text stream event the pipeline loop must ignore (e.g. thinking). */
export function thinkingDeltaEvent(thinking: string): RawMessageStreamEvent {
  return {
    type: "content_block_delta",
    index: 0,
    delta: { type: "thinking_delta", thinking },
  } as unknown as RawMessageStreamEvent;
}

/**
 * The object `client.messages.stream(...)` returns: BOTH an async-iterable of
 * stream events AND a `.finalMessage()` that resolves to a Message. Mirrors the
 * subset of the SDK's MessageStream our code uses.
 */
export interface FakeMessageStream
  extends AsyncIterable<RawMessageStreamEvent> {
  finalMessage(): Promise<Message>;
}

export function fakeStream(
  events: RawMessageStreamEvent[],
  final: Message
): FakeMessageStream {
  return {
    async *[Symbol.asyncIterator]() {
      for (const ev of events) yield ev;
    },
    async finalMessage() {
      return final;
    },
  };
}

/** A stream whose iteration AND finalMessage reject (simulates an API error). */
export function throwingStream(error: Error): FakeMessageStream {
  return {
    // eslint-disable-next-line require-yield
    async *[Symbol.asyncIterator]() {
      throw error;
    },
    async finalMessage() {
      throw error;
    },
  };
}

/** Records each `messages.stream(...)` call's request params for assertions. */
export interface FakeClient {
  calls: unknown[];
  messages: { stream: (params: unknown) => FakeMessageStream };
}

/**
 * Builds a fake Anthropic client. `streamFor` maps each successive call to the
 * stream it should return (so research vs draft can differ); falls back to the
 * last entry for any extra calls.
 */
export function makeFakeClient(streams: FakeMessageStream[]): FakeClient {
  const calls: unknown[] = [];
  let i = 0;
  return {
    calls,
    messages: {
      stream(params: unknown): FakeMessageStream {
        calls.push(params);
        const s = streams[Math.min(i, streams.length - 1)];
        i += 1;
        return s;
      },
    },
  };
}

/** Reads an NDJSON Response body fully and splits into trimmed event lines. */
export async function readNdjson(res: Response): Promise<string[]> {
  const text = await res.text();
  return text.split("\n").filter((l) => l.trim().length > 0);
}

/** Parses an NDJSON Response body into the decoded event objects. */
export async function readEvents<T = Record<string, unknown>>(
  res: Response
): Promise<T[]> {
  const lines = await readNdjson(res);
  return lines.map((l) => JSON.parse(l) as T);
}
