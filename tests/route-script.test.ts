/**
 * Route-handler tests for POST /api/script. Imports the POST function directly
 * and passes a real Request. Uses vi.stubEnv to control ANTHROPIC_API_KEY.
 *
 * The happy path mocks the router's client so no real network is attempted; the
 * focus is that pre-stream failures degrade to 4xx JSON (never a thrown 500).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMessage,
  textBlock,
  webResult,
  webSearchResultBlock,
  textDeltaEvent,
  fakeStream,
  makeFakeClient,
  type FakeClient,
} from "./helpers/anthropic-mocks";

let currentClient: FakeClient;
vi.mock("@/lib/models/router", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/models/router")
  >();
  return { ...actual, anthropicClient: () => currentClient };
});

const { POST } = await import("@/app/api/script/route");

function jsonRequest(body: unknown): Request {
  return new Request("http://test/api/script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  // Give every test a client so the happy path never hits the network.
  currentClient = makeFakeClient([
    fakeStream(
      [],
      mockMessage({
        content: [
          textBlock("- outline"),
          webSearchResultBlock([webResult("https://s.test", "S")]),
        ],
      })
    ),
    fakeStream(
      [textDeltaEvent("body")],
      mockMessage({ content: [textBlock("body")] })
    ),
  ]);
});

describe("POST /api/script — graceful 4xx (no crash) when key is unset", () => {
  it("returns 400 JSON {error} mentioning ANTHROPIC_API_KEY", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(jsonRequest({ title: "5 tennis brands" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("does NOT throw / does NOT return 500 when the key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await POST(jsonRequest({ title: "x" }));
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/script — input validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://test/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/);
  });

  it("returns 400 when the title is missing or blank", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(jsonRequest({ title: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/title or idea is required/);
  });

  it("returns 400 for an unknown channel (with the key set)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(
      jsonRequest({ title: "x", channelId: "nope-channel" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown channel: nope-channel/);
  });
});

describe("POST /api/script — happy path (mocked client)", () => {
  it("returns a 200 streamed NDJSON response with pipeline headers", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const res = await POST(jsonRequest({ title: "5 tennis brands" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("X-Script-Engine")).toBe("pipeline");

    // Drain the body to confirm it streams real events end-to-end.
    const text = await res.text();
    expect(text).toContain('"stage":"research"');
    expect(text).toContain('"type":"token"');
    expect(text.trim().endsWith('{"type":"done"}')).toBe(true);
  });
});
