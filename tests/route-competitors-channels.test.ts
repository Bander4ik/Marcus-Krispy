/**
 * Route-handler tests for /api/competitors/channels (GET/POST/DELETE). Store is
 * pointed at a temp HOME. No key needed (these only edit local channel state).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, POST, DELETE } from "@/app/api/competitors/channels/route";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-chan-route-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

function postRequest(body: unknown): Request {
  return new Request("http://test/api/competitors/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(handle: string): Request {
  return new Request(
    `http://test/api/competitors/channels?handle=${encodeURIComponent(handle)}`,
    { method: "DELETE" }
  );
}

describe("GET — current channels", () => {
  it("returns the 12 seeded channels", async () => {
    const data = (await (await GET()).json()) as { channels: string[] };
    expect(data.channels).toHaveLength(12);
  });
});

describe("POST — add a channel", () => {
  it("adds a channel (normalized) and returns the list", async () => {
    const res = await POST(postRequest({ handle: "newGuy" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { channels: string[] };
    expect(data.channels).toContain("@newGuy");
  });

  it("returns 400 for a blank handle", async () => {
    const res = await POST(postRequest({ handle: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/i);
  });

  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://test/api/competitors/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    });
    expect((await POST(bad)).status).toBe(400);
  });
});

describe("DELETE — remove a channel", () => {
  it("removes a channel and returns the shorter list", async () => {
    const res = await DELETE(deleteRequest("@Tennisnerd"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { channels: string[] };
    expect(data.channels).not.toContain("@Tennisnerd");
    expect(data.channels).toHaveLength(11);
  });

  it("returns 400 when no handle is supplied", async () => {
    const res = await DELETE(
      new Request("http://test/api/competitors/channels", { method: "DELETE" })
    );
    expect(res.status).toBe(400);
  });
});
