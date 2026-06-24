/**
 * Pure-logic tests for the message-parsing helpers in lib/models/anthropic.ts,
 * fed hand-built mock Message objects.
 */
import { describe, it, expect, vi } from "vitest";
import {
  extractText,
  extractSources,
  usageOf,
} from "@/lib/models/anthropic";
import {
  mockMessage,
  textBlock,
  webResult,
  webSearchResultBlock,
  webSearchErrorBlock,
  thinkingBlock,
  serverToolUseBlock,
  fakeStream,
  makeFakeClient,
  type FakeClient,
} from "./helpers/anthropic-mocks";

// --- Mock the router so we can inspect the request streamAnthropic sends. ---
let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return { ...actual, anthropicClient: () => currentClient };
});

// Imported AFTER the mock is registered.
const { streamAnthropic } = await import("@/lib/models/anthropic");

describe("streamAnthropic — Stage-2 draft request shape", () => {
  it("does NOT send `thinking` (a live test showed it starved the draft output)", () => {
    currentClient = makeFakeClient([
      fakeStream([], mockMessage({ content: [textBlock("draft")] })),
    ]);

    streamAnthropic({
      model: "claude-sonnet-4-6",
      system: "SYS",
      user: "Write the full script now.",
    });

    const reqParams = currentClient.calls[0] as Record<string, unknown>;
    // The whole point of fix #1: no extended thinking on the draft.
    expect(reqParams.thinking).toBeUndefined();
    expect("thinking" in reqParams).toBe(false);
  });

  it("caps max_tokens at the safe 8000 ceiling (was 64000) and still streams no tools", () => {
    currentClient = makeFakeClient([
      fakeStream([], mockMessage({ content: [textBlock("draft")] })),
    ]);

    streamAnthropic({ model: "claude-sonnet-4-6", system: "SYS", user: "U" });

    const reqParams = currentClient.calls[0] as Record<string, unknown>;
    expect(reqParams.max_tokens).toBe(8000);
    // Draft never searches; system is still a cached block; user-only messages.
    expect(reqParams.tools).toBeUndefined();
    const system = reqParams.system as Array<Record<string, unknown>>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    const msgs = reqParams.messages as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });

  it("respects an explicit maxTokens override", () => {
    currentClient = makeFakeClient([
      fakeStream([], mockMessage({ content: [textBlock("draft")] })),
    ]);

    streamAnthropic({
      model: "claude-sonnet-4-6",
      system: "SYS",
      user: "U",
      maxTokens: 12000,
    });

    expect(
      (currentClient.calls[0] as Record<string, unknown>).max_tokens
    ).toBe(12000);
  });
});

describe("extractText", () => {
  it("joins all top-level text blocks and trims the result", () => {
    const msg = mockMessage({
      content: [textBlock("  Hello "), textBlock("world  ")],
    });
    expect(extractText(msg)).toBe("Hello world");
  });

  it("ignores non-text blocks (web search results, etc.)", () => {
    const msg = mockMessage({
      content: [
        textBlock("Visible. "),
        webSearchResultBlock([webResult("https://a.test")]),
        textBlock("Still visible."),
      ],
    });
    expect(extractText(msg)).toBe("Visible. Still visible.");
  });

  it("returns an empty string when there is no text content", () => {
    const msg = mockMessage({
      content: [webSearchResultBlock([webResult("https://a.test")])],
    });
    expect(extractText(msg)).toBe("");
  });

  it("ignores thinking + server_tool_use blocks (the real Sonnet-4.6 shape)", () => {
    // What a final message actually looks like with thinking + web search on:
    // thinking → server_tool_use → web_search_tool_result → text.
    const msg = mockMessage({
      content: [
        thinkingBlock("Let me verify the Babolat price…"),
        serverToolUseBlock("Babolat Pure Aero price"),
        webSearchResultBlock([webResult("https://tw.test", "TW")]),
        textBlock("The visible outline."),
      ],
    });
    // Only the text block contributes — NOT the thinking text.
    expect(extractText(msg)).toBe("The visible outline.");
    expect(extractText(msg)).not.toContain("verify the Babolat");
  });
});

describe("extractSources", () => {
  it("pulls url + title from web_search_result items", () => {
    const msg = mockMessage({
      content: [
        webSearchResultBlock([
          webResult("https://a.test", "Site A"),
          webResult("https://b.test", "Site B"),
        ]),
      ],
    });
    expect(extractSources(msg)).toEqual([
      { url: "https://a.test", title: "Site A" },
      { url: "https://b.test", title: "Site B" },
    ]);
  });

  it("dedupes by URL, keeping first-seen order across multiple blocks", () => {
    const msg = mockMessage({
      content: [
        webSearchResultBlock([
          webResult("https://a.test", "A1"),
          webResult("https://b.test", "B"),
        ]),
        webSearchResultBlock([
          webResult("https://a.test", "A2-dup"), // duplicate URL → dropped
          webResult("https://c.test", "C"),
        ]),
      ],
    });
    expect(extractSources(msg)).toEqual([
      { url: "https://a.test", title: "A1" },
      { url: "https://b.test", title: "B" },
      { url: "https://c.test", title: "C" },
    ]);
  });

  it("omits the title field when the result title is empty", () => {
    const msg = mockMessage({
      content: [webSearchResultBlock([webResult("https://a.test", "")])],
    });
    const out = extractSources(msg);
    expect(out).toEqual([{ url: "https://a.test", title: undefined }]);
    expect(Object.prototype.hasOwnProperty.call(out[0], "title")).toBe(true);
    expect(out[0].title).toBeUndefined();
  });

  it("ignores error blocks (content is an object, not an array)", () => {
    const msg = mockMessage({
      content: [
        webSearchErrorBlock("max_uses_exceeded"),
        webSearchResultBlock([webResult("https://ok.test", "OK")]),
      ],
    });
    expect(extractSources(msg)).toEqual([
      { url: "https://ok.test", title: "OK" },
    ]);
  });

  it("ignores non-web_search_result items inside a result block", () => {
    const block = {
      type: "web_search_tool_result",
      tool_use_id: "t",
      content: [
        { type: "something_else", url: "https://skip.test" },
        webResult("https://keep.test", "Keep"),
      ],
    } as unknown as import("@anthropic-ai/sdk/resources/messages").ContentBlock;
    const msg = mockMessage({ content: [textBlock("x"), block] });
    expect(extractSources(msg)).toEqual([
      { url: "https://keep.test", title: "Keep" },
    ]);
  });

  it("returns [] when there are no web-search blocks at all", () => {
    const msg = mockMessage({ content: [textBlock("just prose")] });
    expect(extractSources(msg)).toEqual([]);
  });

  it("ignores server_tool_use + thinking blocks; pulls URLs only from result blocks", () => {
    // The full realistic sequence: a server_tool_use (the query) does NOT carry
    // URLs; only the following web_search_tool_result does.
    const msg = mockMessage({
      content: [
        thinkingBlock("planning searches"),
        serverToolUseBlock("Wilson racquet price"),
        webSearchResultBlock([webResult("https://w.test", "Wilson")]),
        serverToolUseBlock("Babolat price"),
        webSearchResultBlock([webResult("https://b.test", "Babolat")]),
        textBlock("outline"),
      ],
    });
    expect(extractSources(msg)).toEqual([
      { url: "https://w.test", title: "Wilson" },
      { url: "https://b.test", title: "Babolat" },
    ]);
  });

  it("survives a message whose ONLY web block is an error (returns [])", () => {
    const msg = mockMessage({
      content: [
        thinkingBlock("…"),
        serverToolUseBlock(),
        webSearchErrorBlock("max_uses_exceeded"),
        textBlock("partial outline, search budget hit"),
      ],
    });
    expect(extractSources(msg)).toEqual([]);
    // And the text is still recoverable.
    expect(extractText(msg)).toBe("partial outline, search budget hit");
  });
});

describe("usageOf", () => {
  it("maps input/output token counts to the normalized shape", () => {
    const msg = mockMessage({ inputTokens: 1234, outputTokens: 567 });
    expect(usageOf(msg)).toEqual({ inputTokens: 1234, outputTokens: 567 });
  });

  it("tolerates a missing usage object", () => {
    const msg = mockMessage();
    // mockMessage leaves usage tokens undefined unless provided.
    const u = usageOf(msg);
    expect(u.inputTokens).toBeUndefined();
    expect(u.outputTokens).toBeUndefined();
  });
});
