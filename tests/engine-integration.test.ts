/**
 * Mocked-client integration tests for MultiStepEngine.
 *
 * We mock ONLY `anthropicClient()` from the router (so no real network), while
 * keeping the real `pickModel` (model ids, env override behavior). A fake client
 * returns a stream that is both async-iterable AND has finalMessage().
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMessage,
  textBlock,
  webResult,
  webSearchResultBlock,
  textDeltaEvent,
  thinkingDeltaEvent,
  fakeStream,
  throwingStream,
  makeFakeClient,
  readEvents,
  type FakeClient,
  type FakeMessageStream,
} from "./helpers/anthropic-mocks";
import type { Channel, ScriptRequest } from "@/lib/script/types";

// --- Mock the router: real pickModel, fake anthropicClient ---
let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return {
    ...actual,
    anthropicClient: () => currentClient,
  };
});

// Imported AFTER the mock is registered.
const { MultiStepEngine } = await import("@/lib/script/pipeline");

function channelWithPrompts(): Channel {
  return {
    id: "tennistimez",
    name: "TennisTimez",
    task: "script-writing",
    systemPrompt: "persona",
    voiceFingerprint: "voice",
    prompts: {
      step1Research: "STEP1 system\n<Input>{INSERT TITLE HERE}</Input>",
      step2Script:
        "STEP2 system\n<story_structure>{insert blueprint}</story_structure>\n<story_length>{{1900–1950 words}}</story_length>",
      factAudit: "FACT AUDIT system",
    },
    finalLabel: "Script.md",
    placeholder: false,
  };
}

function channelNoPrompts(): Channel {
  return { ...channelWithPrompts(), prompts: undefined };
}

function req(channel: Channel = channelWithPrompts()): ScriptRequest {
  return { title: "5 Tennis Brands Robbing You Blind", channel };
}

/** A research final message with outline text + two sources. */
function researchMessage() {
  return mockMessage({
    content: [
      textBlock("- VIDEO ANGLE\n- Brand: Babolat"),
      webSearchResultBlock([
        webResult("https://tenniswarehouse.test/a", "TW A"),
        webResult("https://tennis-point.test/b", "TP B"),
      ]),
    ],
    inputTokens: 100,
    outputTokens: 200,
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("MultiStepEngine — request shape passed to messages.stream", () => {
  it("research call: sonnet-4-6, adaptive thinking, cached system block, web search tool, no prefill", async () => {
    const researchStream = fakeStream([], researchMessage());
    const draftStream = fakeStream(
      [textDeltaEvent("draft")],
      mockMessage({ content: [textBlock("draft")] })
    );
    currentClient = makeFakeClient([researchStream, draftStream]);

    await new MultiStepEngine().run(req());

    const researchReq = currentClient.calls[0] as Record<string, unknown>;
    expect(researchReq.model).toBe("claude-sonnet-4-6");
    expect(researchReq.thinking).toEqual({ type: "adaptive" });

    // system is a cached text block (array form).
    const system = researchReq.system as Array<Record<string, unknown>>;
    expect(Array.isArray(system)).toBe(true);
    expect(system[0].type).toBe("text");
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text).toContain("STEP1 system");

    // web_search tool present with max_uses.
    const tools = researchReq.tools as Array<Record<string, unknown>>;
    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe("web_search_20250305");
    expect(tools[0].name).toBe("web_search");
    expect(typeof tools[0].max_uses).toBe("number");

    // messages end on the user turn — NO assistant prefill.
    const msgs = researchReq.messages as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[msgs.length - 1].role).toBe("user");
    // The user content is the filled INPUT TEMPLATE.
    expect(msgs[0].content).toContain("YouTube Title:");
  });

  it("draft call: sonnet-4-6, thinking OFF, max_tokens 8000, cached system with substituted blueprint, NO web search tool, no prefill", async () => {
    const researchStream = fakeStream([], researchMessage());
    const draftStream = fakeStream(
      [textDeltaEvent("draft")],
      mockMessage({ content: [textBlock("draft")] })
    );
    currentClient = makeFakeClient([researchStream, draftStream]);

    await new MultiStepEngine().run(req());

    const draftReq = currentClient.calls[1] as Record<string, unknown>;
    expect(draftReq.model).toBe("claude-sonnet-4-6");
    // Draft thinking is OFF: a live test showed adaptive thinking starved the
    // output (0 words of script); quality was excellent with thinking off.
    expect(draftReq.thinking).toBeUndefined();
    expect(draftReq.max_tokens).toBe(8000); // safe ceiling; was 64000
    expect(draftReq.tools).toBeUndefined(); // Stage 2 does not search

    const system = (draftReq.system as Array<Record<string, unknown>>)[0]
      .text as string;
    expect(system).toContain("Babolat"); // outline substituted in
    expect(system).not.toContain("{insert blueprint}");
    expect(system).not.toContain("{{1900–1950 words}}");

    const msgs = draftReq.messages as Array<Record<string, unknown>>;
    expect(msgs[msgs.length - 1].role).toBe("user");
  });

  it("honors SCRIPT_MODEL override on both calls (provider stays Anthropic)", async () => {
    vi.stubEnv("SCRIPT_MODEL", "claude-sonnet-4-6-custom");
    currentClient = makeFakeClient([
      fakeStream([], researchMessage()),
      fakeStream(
        [textDeltaEvent("x")],
        mockMessage({ content: [textBlock("x")] })
      ),
    ]);

    await new MultiStepEngine().run(req());
    expect(
      (currentClient.calls[0] as Record<string, unknown>).model
    ).toBe("claude-sonnet-4-6-custom");
    expect(
      (currentClient.calls[1] as Record<string, unknown>).model
    ).toBe("claude-sonnet-4-6-custom");
  });
});

describe("MultiStepEngine.streamRun — NDJSON event sequence", () => {
  it("emits research start → research done {outline,sources} → draft start → token×N → done", async () => {
    const deltas = ["The ", "tennis ", "script."];
    const researchStream = fakeStream([], researchMessage());
    const draftStream = fakeStream(
      [
        thinkingDeltaEvent("(internal reasoning ignored)"),
        ...deltas.map(textDeltaEvent),
      ],
      mockMessage({ content: [textBlock(deltas.join(""))] })
    );
    currentClient = makeFakeClient([researchStream, draftStream]);

    const res = new MultiStepEngine().streamRun(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Script-Engine")).toBe("pipeline");
    expect(res.headers.get("X-Script-Model")).toBe("claude-sonnet-4-6");

    const events = await readEvents(res);
    expect(events).toEqual([
      { type: "stage", stage: "research", status: "start" },
      {
        type: "stage",
        stage: "research",
        status: "done",
        outline: "- VIDEO ANGLE\n- Brand: Babolat",
        sources: [
          { url: "https://tenniswarehouse.test/a", title: "TW A" },
          { url: "https://tennis-point.test/b", title: "TP B" },
        ],
      },
      { type: "stage", stage: "draft", status: "start" },
      { type: "token", text: "The " },
      { type: "token", text: "tennis " },
      { type: "token", text: "script." },
      { type: "done" },
    ]);
  });

  it("emits exactly one token event per text_delta and ignores non-text deltas", async () => {
    const draftEvents = [
      textDeltaEvent("a"),
      thinkingDeltaEvent("skip"),
      textDeltaEvent("b"),
    ];
    currentClient = makeFakeClient([
      fakeStream([], researchMessage()),
      fakeStream(draftEvents, mockMessage({ content: [textBlock("ab")] })),
    ]);

    const events = await readEvents(new MultiStepEngine().streamRun(req()));
    const tokens = events.filter((e) => e.type === "token");
    expect(tokens).toEqual([
      { type: "token", text: "a" },
      { type: "token", text: "b" },
    ]);
  });

  it("when research THROWS, emits a single error event and closes (no crash, no done)", async () => {
    const researchStream = throwingStream(new Error("web search exploded"));
    // Draft stream should never be consumed.
    const draftStream = fakeStream(
      [textDeltaEvent("never")],
      mockMessage({ content: [textBlock("never")] })
    );
    currentClient = makeFakeClient([researchStream, draftStream]);

    const res = new MultiStepEngine().streamRun(req());
    expect(res.status).toBe(200); // stream opened; error is in-band
    const events = await readEvents(res);

    // research start was already sent, then the error.
    expect(events).toContainEqual({
      type: "stage",
      stage: "research",
      status: "start",
    });
    const errors = events.filter((e) => e.type === "error");
    expect(errors).toHaveLength(1);
    expect((errors[0] as { message: string }).message).toBe(
      "web search exploded"
    );
    expect(events.some((e) => e.type === "done")).toBe(false);
    expect(events.some((e) => e.type === "token")).toBe(false);
    // Only the research call happened.
    expect(currentClient.calls).toHaveLength(1);
  });

  it("when the DRAFT stream throws mid-iteration, emits prior stages then one error", async () => {
    currentClient = makeFakeClient([
      fakeStream([], researchMessage()),
      throwingStream(new Error("draft died")),
    ]);
    const events = await readEvents(new MultiStepEngine().streamRun(req()));
    expect(events.filter((e) => e.type === "error")).toHaveLength(1);
    expect(events.some((e) => e.type === "done")).toBe(false);
    // research done + draft start were emitted before the failure.
    expect(
      events.some(
        (e) =>
          e.type === "stage" && e.stage === "draft" && e.status === "start"
      )
    ).toBe(true);
  });
});

describe("MultiStepEngine.streamRun — degenerate research output", () => {
  it("when research yields an EMPTY outline + NO sources, Stage 2 still runs", async () => {
    // A research call that returns only whitespace text and no web results.
    const emptyResearch = mockMessage({ content: [textBlock("   ")] });
    currentClient = makeFakeClient([
      fakeStream([], emptyResearch),
      fakeStream(
        [textDeltaEvent("fallback body")],
        mockMessage({ content: [textBlock("fallback body")] })
      ),
    ]);

    const events = await readEvents(new MultiStepEngine().streamRun(req()));

    // research done carries an empty outline + empty sources…
    const researchDone = events.find(
      (e) => e.type === "stage" && e.stage === "research" && e.status === "done"
    ) as { outline: string; sources: unknown[] } | undefined;
    expect(researchDone).toBeDefined();
    expect(researchDone!.outline).toBe(""); // extractText trims to ""
    expect(researchDone!.sources).toEqual([]);

    // …and Stage 2 STILL runs (draft start + tokens + done). This documents the
    // current contract: an empty blueprint does not abort the pipeline — the
    // draft system prompt is built with an empty <story_structure>. (Whether the
    // model should be allowed to write from an empty blueprint is a product
    // decision; flagged in STATUS.md as a first-live-run item.)
    expect(
      events.some(
        (e) => e.type === "stage" && e.stage === "draft" && e.status === "start"
      )
    ).toBe(true);
    expect(events).toContainEqual({ type: "token", text: "fallback body" });
    expect(events.some((e) => e.type === "done")).toBe(true);
    // Both calls happened (research + draft).
    expect(currentClient.calls).toHaveLength(2);
  });

  it("when finalMessage has ZERO text blocks, the script is empty (no crash)", async () => {
    // Draft's final message has only a thinking block, no text.
    currentClient = makeFakeClient([
      fakeStream([], researchMessage()),
      fakeStream(
        [thinkingDeltaEvent("(only reasoning, no visible text)")],
        mockMessage({ content: [textBlock("")] })
      ),
    ]);
    const result = await new MultiStepEngine().run(req());
    expect(result.script).toBe(""); // extractText → "" rather than throwing
    expect(result.outline).toBe("- VIDEO ANGLE\n- Brand: Babolat");
  });
});

describe("MultiStepEngine.streamRun — fail-fast on missing prompts", () => {
  it("throws synchronously (route catches) when the channel has no prompts", () => {
    currentClient = makeFakeClient([fakeStream([], researchMessage())]);
    expect(() =>
      new MultiStepEngine().streamRun(req(channelNoPrompts()))
    ).toThrow(/no staged prompts/i);
  });
});

describe("MultiStepEngine.run — non-streaming result", () => {
  it("returns {script, outline, sources, model, usage}", async () => {
    const draftFinal = mockMessage({
      content: [textBlock("Full tennis script body.")],
      inputTokens: 11,
      outputTokens: 22,
    });
    currentClient = makeFakeClient([
      fakeStream([], researchMessage()),
      fakeStream([textDeltaEvent("Full tennis script body.")], draftFinal),
    ]);

    const result = await new MultiStepEngine().run(req());
    expect(result.script).toBe("Full tennis script body.");
    expect(result.outline).toBe("- VIDEO ANGLE\n- Brand: Babolat");
    expect(result.sources).toEqual([
      { url: "https://tenniswarehouse.test/a", title: "TW A" },
      { url: "https://tennis-point.test/b", title: "TP B" },
    ]);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 22 });
  });
});

describe("MultiStepEngine.factAudit — Stage-3 seam delegation", () => {
  it("streams the audit using the channel's fact_audit prompt as the system block", async () => {
    currentClient = makeFakeClient([
      fakeStream(
        [textDeltaEvent("audit body")],
        mockMessage({ content: [textBlock("audit body")] })
      ),
    ]);

    const res = new MultiStepEngine().factAudit(req(), {
      phase: "audit",
      script: "Babolat costs $250.",
      turns: [],
    });
    expect(res.headers.get("X-Audit-Phase")).toBe("audit");

    const events = await readEvents(res);
    expect(events[0]).toEqual({
      type: "stage",
      stage: "audit",
      status: "start",
    });
    expect(events).toContainEqual({ type: "token", text: "audit body" });

    // The channel's factAudit prompt was used as the (cached) system block.
    const system = (
      (currentClient.calls[0] as Record<string, unknown>).system as Array<
        Record<string, unknown>
      >
    )[0].text as string;
    expect(system).toBe("FACT AUDIT system");
  });

  it("throws (route catches) when the channel has no prompts", () => {
    currentClient = makeFakeClient([fakeStream([], researchMessage())]);
    expect(() =>
      new MultiStepEngine().factAudit(req(channelNoPrompts()), {
        phase: "audit",
        script: "S",
        turns: [],
      })
    ).toThrow(/no staged prompts/i);
  });
});

// Type-only export use to keep the import list honest if refactored.
export type _Unused = FakeMessageStream;
