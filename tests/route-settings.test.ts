/**
 * Route-handler tests for /api/settings (GET/POST/DELETE). Imports the handlers
 * directly and passes real Requests. The store is pointed at a temp HOME via
 * MARCUS_KRISPY_HOME so the suite never touches the real ~/.marcus-krispy.
 *
 * Key invariants under test:
 *   - the masked status NEVER contains the full key (only last4)
 *   - POST rejects a non-"sk-ant-" value with 400
 *   - POST valid → set (source "file"); DELETE → cleared
 *   - env precedence is reflected: env present → source "env", envPresent true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, POST, DELETE } from "@/app/api/settings/route";

let tmpHome: string;

const VALID_KEY = "sk-ant-api03-abcdef ghijklmnop1234".replace(" ", "");

interface KeyStatus {
  set: boolean;
  source: "env" | "file" | null;
  last4: string | null;
  envPresent: boolean;
  model?: string;
  error?: string;
}

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-route-settings-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
  // Default: no env key, so the file path is exercised unless a test overrides.
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

function postRequest(body: unknown): Request {
  return new Request("http://test/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function statusOf(res: Response): Promise<KeyStatus> {
  return (await res.json()) as KeyStatus;
}

describe("GET /api/settings — masked status", () => {
  it("reports not-set when no env and no saved key", async () => {
    const data = await statusOf(await GET());
    expect(data).toMatchObject({
      set: false,
      source: null,
      last4: null,
      envPresent: false,
    });
  });

  it("reports source 'env' + envPresent when the env key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-environment-key-9876");
    const data = await statusOf(await GET());
    expect(data.set).toBe(true);
    expect(data.source).toBe("env");
    expect(data.envPresent).toBe(true);
    expect(data.last4).toBe("9876");
  });

  it("never returns the full key (no field equals the key)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-supersecret-value-0001");
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("sk-ant-supersecret-value-0001");
    expect(text).not.toContain("supersecret");
  });
});

describe("POST /api/settings — validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const bad = new Request("http://test/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await statusOf(res)).error).toMatch(/Invalid JSON/);
  });

  it("rejects a non-sk-ant value with 400", async () => {
    const res = await POST(postRequest({ anthropicKey: "totally-not-a-key" }));
    expect(res.status).toBe(400);
    expect((await statusOf(res)).error).toMatch(/sk-ant/);
  });

  it("rejects an empty/whitespace key with 400", async () => {
    const res = await POST(postRequest({ anthropicKey: "   " }));
    expect(res.status).toBe(400);
    expect((await statusOf(res)).error).toMatch(/required/i);
  });

  it("rejects a too-short sk-ant value with 400", async () => {
    const res = await POST(postRequest({ anthropicKey: "sk-ant-" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/settings — saves a valid key", () => {
  it("saves a valid key and returns source 'file' with last4 only", async () => {
    const res = await POST(postRequest({ anthropicKey: VALID_KEY }));
    expect(res.status).toBe(200);
    const data = await statusOf(res);
    expect(data.set).toBe(true);
    expect(data.source).toBe("file");
    expect(data.last4).toBe(VALID_KEY.slice(-4));
    expect(data.envPresent).toBe(false);
  });

  it("the POST response never echoes the full key", async () => {
    const res = await POST(postRequest({ anthropicKey: VALID_KEY }));
    const text = await res.text();
    expect(text).not.toContain(VALID_KEY);
  });

  it("a subsequent GET reflects the saved key", async () => {
    await POST(postRequest({ anthropicKey: VALID_KEY }));
    const data = await statusOf(await GET());
    expect(data.set).toBe(true);
    expect(data.source).toBe("file");
    expect(data.last4).toBe(VALID_KEY.slice(-4));
  });

  it("env takes precedence over a saved file key in the status", async () => {
    await POST(postRequest({ anthropicKey: VALID_KEY }));
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-environment-key-5555");
    const data = await statusOf(await GET());
    expect(data.source).toBe("env");
    expect(data.envPresent).toBe(true);
    expect(data.last4).toBe("5555");
  });
});

describe("DELETE /api/settings — clears the saved key", () => {
  it("clears a saved key and returns not-set", async () => {
    await POST(postRequest({ anthropicKey: VALID_KEY }));
    const res = await DELETE();
    expect(res.status).toBe(200);
    const data = await statusOf(res);
    expect(data.set).toBe(false);
    expect(data.source).toBe(null);
    expect(data.last4).toBe(null);
  });

  it("does not touch the env key (env still reported after delete)", async () => {
    await POST(postRequest({ anthropicKey: VALID_KEY }));
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-environment-key-7777");
    const data = await statusOf(await DELETE());
    // Env key remains; status still reports it.
    expect(data.set).toBe(true);
    expect(data.source).toBe("env");
    expect(data.last4).toBe("7777");
  });
});
