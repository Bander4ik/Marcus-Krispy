/**
 * Route-handler tests for POST /api/fact-audit. Imports POST directly, passes a
 * real Request, and uses vi.stubEnv for the key.
 *
 * Covers the 4xx JSON degradations: missing key, empty script, unknown phase,
 * unknown channel — plus a mocked-client happy path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMessage,
  textBlock,
  textDeltaEvent,
  fakeStream,
  makeFakeClient,
  type FakeClient,
} from "./helpers/anthropic-mocks";
import { CONFIRM_REWRITE } from "@/lib/script/fact-audit-shared";

let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return { ...actual, anthropicClient: () => currentClient };
});

const { POST } = await import("@/app/api/fact-audit/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://test/api/fact-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  currentClient = makeFakeClient([
    fakeStream(
      [textDeltaEvent("audit body")],
      mockMessage({ content: [textBlock("audit body")] })
    ),
  ]);
});

describe("POST /api/fact-audit — validation precedes the key check", () => {
  it("returns 400 for an unknown phase (even with no key)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(jsonRequest({ phase: "bogus", script: "S" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown phase/);
  });

  it("returns 400 for an empty script", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(jsonRequest({ phase: "audit", script: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No script to audit/);
  });

  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://test/api/fact-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/);
  });

  it("returns 400 for rewrite with no prior turns", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(jsonRequest({ phase: "rewrite", script: "S" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing prior audit context/);
  });
});

describe("POST /api/fact-audit — missing key", () => {
  it("returns 400 JSON mentioning ANTHROPIC_API_KEY when validation passes but key is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(
      jsonRequest({ phase: "audit", script: "A real script body." })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("never returns 500 for the missing-key case", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(
      jsonRequest({ phase: "audit", script: "A real script body." })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/fact-audit — unknown channel", () => {
  it("returns 400 JSON for an unknown channel (key set, script valid)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      jsonRequest({
        phase: "audit",
        script: "A real script body.",
        channelId: "no-such-channel",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(
      /Unknown channel: no-such-channel/
    );
  });
});

describe("POST /api/fact-audit — happy path (mocked client)", () => {
  it("streams a 200 NDJSON audit response for Phase 1", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      jsonRequest({ phase: "audit", script: "Babolat costs $250." })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Audit-Phase")).toBe("audit");
    const text = await res.text();
    expect(text).toContain('"stage":"audit"');
    expect(text).toContain('"type":"token"');
    expect(text.trim().endsWith('{"type":"done"}')).toBe(true);
  });

  it("streams Phase 2 when valid prior turns are supplied", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    currentClient = makeFakeClient([
      fakeStream(
        [textDeltaEvent("rewritten")],
        mockMessage({ content: [textBlock("rewritten")] })
      ),
    ]);
    const res = await POST(
      jsonRequest({
        phase: "rewrite",
        script: "Original body.",
        turns: [
          { role: "user", text: "Original body." },
          { role: "assistant", text: "Phase 1 audit." },
          { role: "user", text: CONFIRM_REWRITE },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Audit-Phase")).toBe("rewrite");
    expect(await res.text()).toContain('"text":"rewritten"');
  });
});
