/**
 * Tests for getScriptEngine() selection + the SingleShotEngine integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMessage,
  textBlock,
  textDeltaEvent,
  thinkingDeltaEvent,
  fakeStream,
  throwingStream,
  makeFakeClient,
  readEvents,
  type FakeClient,
} from "./helpers/anthropic-mocks";
import type { Channel, ScriptRequest } from "@/lib/script/types";

let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return { ...actual, anthropicClient: () => currentClient };
});

const { getScriptEngine } = await import("@/lib/script/engine");
const { MultiStepEngine } = await import("@/lib/script/pipeline");
const { SingleShotEngine } = await import("@/lib/script/single-shot");

beforeEach(() => {
  vi.unstubAllEnvs();
});

function channel(): Channel {
  return {
    id: "tennistimez",
    name: "TennisTimez",
    task: "script-writing",
    systemPrompt: "You are the TennisTimez writer.",
    voiceFingerprint: "Punchy. Sharp. Tennis.",
    finalLabel: "Script.md",
    placeholder: false,
  };
}

describe("getScriptEngine", () => {
  it("defaults to the MultiStepEngine when SCRIPT_ENGINE is unset", () => {
    expect(getScriptEngine()).toBeInstanceOf(MultiStepEngine);
  });

  it('defaults to MultiStepEngine for SCRIPT_ENGINE="pipeline"', () => {
    vi.stubEnv("SCRIPT_ENGINE", "pipeline");
    expect(getScriptEngine()).toBeInstanceOf(MultiStepEngine);
  });

  it('returns the SingleShotEngine for SCRIPT_ENGINE="single-shot"', () => {
    vi.stubEnv("SCRIPT_ENGINE", "single-shot");
    expect(getScriptEngine()).toBeInstanceOf(SingleShotEngine);
  });

  it("falls back to MultiStepEngine for an unrecognized value", () => {
    vi.stubEnv("SCRIPT_ENGINE", "totally-unknown");
    expect(getScriptEngine()).toBeInstanceOf(MultiStepEngine);
  });
});

describe("SingleShotEngine — streamRun", () => {
  function req(): ScriptRequest {
    return { title: "  Best tennis racquets  ", channel: channel() };
  }

  it("emits draft start → token×N → done (no research stage)", async () => {
    currentClient = makeFakeClient([
      fakeStream(
        [
          thinkingDeltaEvent("ignore"),
          textDeltaEvent("Hook. "),
          textDeltaEvent("Body."),
        ],
        mockMessage({ content: [textBlock("Hook. Body.")] })
      ),
    ]);

    const res = new SingleShotEngine().streamRun(req());
    expect(res.headers.get("X-Script-Engine")).toBe("single-shot");
    const events = await readEvents(res);
    expect(events).toEqual([
      { type: "stage", stage: "draft", status: "start" },
      { type: "token", text: "Hook. " },
      { type: "token", text: "Body." },
      { type: "done" },
    ]);
  });

  it("builds a system block with persona + voice reference and a trimmed-title user msg", async () => {
    currentClient = makeFakeClient([
      fakeStream(
        [textDeltaEvent("x")],
        mockMessage({ content: [textBlock("x")] })
      ),
    ]);
    await readEvents(new SingleShotEngine().streamRun(req()));

    const params = currentClient.calls[0] as Record<string, unknown>;
    const system = (params.system as Array<Record<string, unknown>>)[0]
      .text as string;
    expect(system).toContain("You are the TennisTimez writer.");
    expect(system).toContain("Voice reference");
    expect(system).toContain("Punchy. Sharp. Tennis.");

    const msgs = params.messages as Array<Record<string, unknown>>;
    expect(msgs[0].content).toContain("Best tennis racquets");
    // Title was trimmed (no leading double-space block).
    expect(msgs[0].content).not.toContain("  Best tennis racquets  ");
    expect(msgs[msgs.length - 1].role).toBe("user");
  });

  it("surfaces an error event when the stream throws", async () => {
    currentClient = makeFakeClient([throwingStream(new Error("ss boom"))]);
    const events = await readEvents(new SingleShotEngine().streamRun(req()));
    expect(events.filter((e) => e.type === "error")).toEqual([
      { type: "error", message: "ss boom" },
    ]);
    expect(events.some((e) => e.type === "done")).toBe(false);
  });
});

describe("SingleShotEngine — run (non-streaming)", () => {
  it("returns the joined script text + usage", async () => {
    const final = mockMessage({
      content: [textBlock("One-shot "), textBlock("script.")],
      inputTokens: 7,
      outputTokens: 8,
    });
    currentClient = makeFakeClient([fakeStream([textDeltaEvent("x")], final)]);

    const result = await new SingleShotEngine().run({
      title: "T",
      channel: channel(),
    });
    expect(result.script).toBe("One-shot script.");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 8 });
  });
});
