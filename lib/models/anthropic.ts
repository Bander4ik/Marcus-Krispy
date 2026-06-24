/**
 * Anthropic SDK wrapper — strong-model (script-writing) calls.
 *
 * Model policy (per the claude-api skill, Sonnet 4.6 / claude-sonnet-4-6):
 *   - thinking: { type: "adaptive" }  — adaptive thinking on the RESEARCH and
 *                                       fact-audit calls (NOT budget_tokens).
 *                                       The Stage-2 DRAFT runs with thinking OFF
 *                                       (a live test showed thinking starved the
 *                                       draft output — see streamAnthropic).
 *   - NO assistant prefill            — last-assistant-turn prefills 400 on 4.6
 *   - system as a cached block        — the channel persona is stable across
 *                                       requests, so it earns cache hits
 *   - stream for long outputs         — we stream the draft to avoid HTTP idle
 *                                       timeouts on the long generation
 *
 * Web search (Stage 1 research):
 *   - The official Anthropic server-side web search tool is enabled so Claude
 *     actually researches real sources. Verified against @anthropic-ai/sdk
 *     0.105.0: the GA tool is `{ type: "web_search_20250305", name: "web_search" }`
 *     (member of `ToolUnion`, accepted by messages.stream/create). Results come
 *     back as `web_search_tool_result` blocks whose content is an array of
 *     `web_search_result` blocks ({ url, title, page_age, encrypted_content }).
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  Message,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages";
import { anthropicClient } from "@/lib/models/router";
import type { SourceLink } from "@/lib/script/types";

/** GA web search tool (verified present in @anthropic-ai/sdk 0.105.0). */
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
} as const;

export interface StreamAnthropicParams {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}

/**
 * Returns the SDK message stream for a streamed script generation (Stage 2).
 * The caller iterates text deltas into the HTTP response, or awaits
 * `.finalMessage()` for the non-streaming path.
 */
export function streamAnthropic(
  params: StreamAnthropicParams
): ReturnType<Anthropic["messages"]["stream"]> {
  const { model, system, user, maxTokens = 8000 } = params;
  const client = anthropicClient();

  // NO thinking on the draft. A live test showed adaptive thinking starved the
  // output — the model spent its entire token budget reasoning and emitted 0
  // words of script; re-running with thinking OFF produced the full, excellent
  // ~2155-word script in ~82s. Draft quality was excellent without thinking.
  // max_tokens 8000 is a safe ceiling (a ~2000-word script is ~3000 tokens).
  return client.messages.stream({
    model,
    max_tokens: maxTokens,
    // Cached system block — stable channel persona earns cache hits.
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    // System + user only. No assistant prefill (400s on Sonnet 4.6).
    messages: [{ role: "user", content: user }],
  });
}

export interface ResearchAnthropicParams {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  /** Cap the number of web searches per request (keeps cost/latency bounded). */
  maxSearches?: number;
}

/**
 * Stage 1 — research + structure. Runs a single Anthropic call with the
 * server-side web search tool and adaptive thinking enabled, then resolves the
 * final message (server-side tool loop is handled by the SDK; web search needs
 * no client round-trip). Streaming is used under the hood so the long research
 * call doesn't hit an HTTP idle timeout.
 *
 * Returns the resolved `Message` — the caller extracts the outline text and the
 * surfaced source URLs from its content blocks.
 */
export async function researchAnthropic(
  params: ResearchAnthropicParams
): Promise<Message> {
  const { model, system, user, maxTokens = 16000, maxSearches = 8 } = params;
  const client = anthropicClient();

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ ...WEB_SEARCH_TOOL, max_uses: maxSearches }],
    messages: [{ role: "user", content: user }],
  });

  return stream.finalMessage();
}

export interface ConverseAnthropicParams {
  model: string;
  /** System prompt, sent as a cached block (stable across the phases). */
  system: string;
  /** The full running conversation (user/assistant turns), oldest first. */
  messages: MessageParam[];
  maxTokens?: number;
  /** Cap the number of web searches per request (keeps cost/latency bounded). */
  maxSearches?: number;
}

/**
 * Multi-turn streamed conversation WITH server-side web search + adaptive
 * thinking. Used by the fact-audit flow (lib/script/fact-audit.ts), where each
 * phase references the prior turns ("the TEXT directly above this message") and
 * the model must verify claims online.
 *
 * Returns the SDK message stream; the caller forwards text deltas to the HTTP
 * response (and may await `.finalMessage()` for the non-streaming path).
 *
 * THINKING: we use `{ type: "adaptive" }` (the GA mode for Sonnet 4.6), not
 * `{ type: "enabled", budget_tokens }`. Per the claude-api guidance, fixed
 * `budget_tokens` is DEPRECATED on 4.6 (still functional, but adaptive is the
 * recommended path). Adaptive also removes the `budget_tokens < max_tokens`
 * foot-gun and matches Stage 1/2 of the pipeline (which already use adaptive),
 * so the whole app is consistent.
 *
 * MULTI-TURN + THINKING: conversation history is plain text per turn — we do
 * NOT replay prior `thinking` / `tool_use` blocks. The Anthropic API ACCEPTS
 * this (a 200): the docs state "you can omit thinking blocks from prior
 * assistant role turns". The 400 ("blocks … cannot be modified") only fires if
 * thinking blocks are MODIFIED, or if the LATEST assistant turn carries a
 * tool_use without its thinking block during a tool loop. Neither applies here:
 * each phase is a fresh request whose final turn is a `user` confirmation, and
 * web search resolves fully server-side inside one `.finalMessage()` — there is
 * no client-replayed tool_use turn. (First-live-run item in STATUS.md confirms
 * this end-to-end.)
 */
export function converseAnthropic(
  params: ConverseAnthropicParams
): ReturnType<Anthropic["messages"]["stream"]> {
  const { model, system, messages, maxTokens = 32000, maxSearches = 10 } =
    params;
  const client = anthropicClient();

  return client.messages.stream({
    model,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [{ ...WEB_SEARCH_TOOL, max_uses: maxSearches }],
    messages,
  });
}

/** Joins all top-level text blocks of a message into a single string. */
export function extractText(message: Message): string {
  return message.content
    .map((b: ContentBlock) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/**
 * Pulls every web-search source URL (with title) out of a message's
 * `web_search_tool_result` blocks, deduped by URL in first-seen order.
 */
export function extractSources(message: Message): SourceLink[] {
  const seen = new Set<string>();
  const out: SourceLink[] = [];

  for (const block of message.content) {
    if (block.type !== "web_search_tool_result") continue;
    const content = block.content;
    if (!Array.isArray(content)) continue; // error blocks aren't arrays
    for (const item of content) {
      if (item.type !== "web_search_result") continue;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push({ url: item.url, title: item.title || undefined });
    }
  }

  return out;
}

/** Reads token usage off a final message in our normalized shape. */
export function usageOf(message: Message): {
  inputTokens?: number;
  outputTokens?: number;
} {
  return {
    inputTokens: message.usage?.input_tokens,
    outputTokens: message.usage?.output_tokens,
  };
}
