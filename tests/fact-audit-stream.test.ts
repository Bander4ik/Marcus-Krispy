/**
 * Mocked-client integration tests for streamFactAudit (lib/script/fact-audit.ts).
 * Drives each phase (audit / rewrite / reaudit) with a fake Anthropic client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMessage,
  textBlock,
  textDeltaEvent,
  fakeStream,
  throwingStream,
  makeFakeClient,
  readEvents,
  type FakeClient,
} from "./helpers/anthropic-mocks";
import {
  CONFIRM_REWRITE,
  CONFIRM_REAUDIT,
  type AuditTurn,
} from "@/lib/script/fact-audit-shared";

let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return { ...actual, anthropicClient: () => currentClient };
});

const { streamFactAudit } = await import("@/lib/script/fact-audit");

const SYSTEM = "FACT AUDIT SYSTEM PROMPT";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("streamFactAudit — Phase 1 (audit)", () => {
  it("streams audit start → token×N → done and frames script as <TEXT>", async () => {
    const deltas = ["Claim ", "table…"];
    currentClient = makeFakeClient([
      fakeStream(
        deltas.map(textDeltaEvent),
        mockMessage({ content: [textBlock(deltas.join(""))] })
      ),
    ]);

    const res = streamFactAudit({
      systemPrompt: SYSTEM,
      input: { phase: "audit", script: "Babolat costs $250.", turns: [] },
    });
    expect(res.headers.get("X-Audit-Phase")).toBe("audit");
    expect(res.headers.get("X-Script-Model")).toBe("claude-sonnet-4-6");

    const events = await readEvents(res);
    expect(events).toEqual([
      { type: "stage", stage: "audit", status: "start" },
      { type: "token", text: "Claim " },
      { type: "token", text: "table…" },
      { type: "done" },
    ]);

    // Request shape: cached system, web search tool, ADAPTIVE thinking (GA path
    // for Sonnet 4.6 — budget_tokens is deprecated on 4.6).
    const reqParams = currentClient.calls[0] as Record<string, unknown>;
    expect(reqParams.model).toBe("claude-sonnet-4-6");
    expect(reqParams.thinking).toEqual({ type: "adaptive" });
    // Deprecated fixed-budget config must NOT be sent.
    expect(
      (reqParams.thinking as Record<string, unknown>).budget_tokens
    ).toBeUndefined();
    const tools = reqParams.tools as Array<Record<string, unknown>>;
    expect(tools[0].type).toBe("web_search_20250305");

    // Single user turn framing the script.
    const msgs = reqParams.messages as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toContain("<TEXT>");
    expect(msgs[0].content).toContain("Babolat costs $250.");
  });
});

describe("streamFactAudit — Phase 2 (rewrite)", () => {
  it("replays alternating turns ending on the CONFIRM_REWRITE user turn", async () => {
    const turns: AuditTurn[] = [
      { role: "user", text: "Original body." },
      { role: "assistant", text: "Phase 1 audit." },
      { role: "user", text: CONFIRM_REWRITE },
    ];
    currentClient = makeFakeClient([
      fakeStream(
        [textDeltaEvent("Rewritten body.")],
        mockMessage({ content: [textBlock("Rewritten body.")] })
      ),
    ]);

    const res = streamFactAudit({
      systemPrompt: SYSTEM,
      input: { phase: "rewrite", script: "Original body.", turns },
    });
    expect(res.headers.get("X-Audit-Phase")).toBe("rewrite");

    const events = await readEvents(res);
    expect(events[0]).toEqual({
      type: "stage",
      stage: "audit",
      status: "start",
    });
    expect(events).toContainEqual({ type: "token", text: "Rewritten body." });
    expect(events[events.length - 1]).toEqual({ type: "done" });

    const msgs = (currentClient.calls[0] as Record<string, unknown>)
      .messages as Array<Record<string, unknown>>;
    // First user turn re-framed as TEXT; last turn is the canonical confirm.
    expect(msgs[0].content).toContain("<TEXT>");
    expect(msgs[0].content).toContain("Original body.");
    expect(msgs[msgs.length - 1].role).toBe("user");
    expect(msgs[msgs.length - 1].content).toBe(CONFIRM_REWRITE);
    // Strictly alternating roles.
    msgs.forEach((m, i) =>
      expect(m.role).toBe(i % 2 === 0 ? "user" : "assistant")
    );
  });
});

describe("streamFactAudit — Phase 3 (reaudit)", () => {
  it("passes the full conversation ending on CONFIRM_REAUDIT", async () => {
    const turns: AuditTurn[] = [
      { role: "user", text: "Original body." },
      { role: "assistant", text: "Phase 1 audit." },
      { role: "user", text: CONFIRM_REWRITE },
      { role: "assistant", text: "Rewritten body." },
      { role: "user", text: CONFIRM_REAUDIT },
    ];
    currentClient = makeFakeClient([
      fakeStream(
        [textDeltaEvent("R001 delta summary…")],
        mockMessage({ content: [textBlock("R001 delta summary…")] })
      ),
    ]);

    const res = streamFactAudit({
      systemPrompt: SYSTEM,
      input: { phase: "reaudit", script: "Original body.", turns },
    });
    expect(res.headers.get("X-Audit-Phase")).toBe("reaudit");
    const events = await readEvents(res);
    expect(events).toContainEqual({
      type: "token",
      text: "R001 delta summary…",
    });

    const msgs = (currentClient.calls[0] as Record<string, unknown>)
      .messages as Array<Record<string, unknown>>;
    expect(msgs).toHaveLength(5);
    expect(msgs[msgs.length - 1].content).toBe(CONFIRM_REAUDIT);
  });
});

describe("streamFactAudit — error path", () => {
  it("emits audit start then a single error event when the model stream throws", async () => {
    currentClient = makeFakeClient([
      throwingStream(new Error("audit model failed")),
    ]);
    const res = streamFactAudit({
      systemPrompt: SYSTEM,
      input: { phase: "audit", script: "S", turns: [] },
    });
    const events = await readEvents(res);
    expect(events[0]).toEqual({
      type: "stage",
      stage: "audit",
      status: "start",
    });
    const errs = events.filter((e) => e.type === "error");
    expect(errs).toHaveLength(1);
    expect((errs[0] as { message: string }).message).toBe(
      "audit model failed"
    );
    expect(events.some((e) => e.type === "done")).toBe(false);
  });
});
