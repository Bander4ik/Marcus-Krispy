/**
 * Tests for resolveYouTubeKey() precedence (lib/env.ts) + the YouTube-key store
 * functions. Mirrors resolve-key.test.ts: env-first with a saved-file fallback.
 * Store is pointed at a temp HOME so the real ~/.marcus-krispy is untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveYouTubeKey, getYouTubeKey } from "@/lib/env";
import {
  saveYouTubeKey,
  getSavedYouTubeKey,
  clearYouTubeKey,
  getSavedAnthropicKey,
  saveAnthropicKey,
} from "@/lib/settings/store";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-resolve-yt-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
  vi.stubEnv("YOUTUBE_DATA_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("resolveYouTubeKey precedence", () => {
  it("returns the env key when YOUTUBE_DATA_API_KEY is set", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "AIza-env");
    expect(await resolveYouTubeKey()).toBe("AIza-env");
  });

  it("env wins even when a file key is also saved", async () => {
    await saveYouTubeKey("AIza-file");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "AIza-env");
    expect(await resolveYouTubeKey()).toBe("AIza-env");
  });

  it("falls back to the saved file key when the env is empty", async () => {
    await saveYouTubeKey("AIza-file");
    expect(await resolveYouTubeKey()).toBe("AIza-file");
  });

  it("treats a whitespace-only env key as empty and uses the file key", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "   ");
    await saveYouTubeKey("AIza-file");
    expect(await resolveYouTubeKey()).toBe("AIza-file");
  });

  it("returns undefined when neither env nor file is set", async () => {
    expect(await resolveYouTubeKey()).toBeUndefined();
  });

  it("getYouTubeKey reads the env only (no file fallback)", async () => {
    await saveYouTubeKey("AIza-file");
    expect(getYouTubeKey()).toBeUndefined(); // env empty
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "  AIza-env  ");
    expect(getYouTubeKey()).toBe("AIza-env"); // trimmed
  });
});

describe("YouTube key store functions", () => {
  it("save → get → clear round-trip", async () => {
    expect(await getSavedYouTubeKey()).toBeUndefined();
    await saveYouTubeKey("  AIza-spaces  ");
    expect(await getSavedYouTubeKey()).toBe("AIza-spaces"); // trimmed
    await clearYouTubeKey();
    expect(await getSavedYouTubeKey()).toBeUndefined();
  });

  it("is stored in the 0600 secrets.json (same file as the Anthropic key)", async () => {
    await saveYouTubeKey("AIza-perm");
    const file = path.join(tmpHome, ".marcus-krispy", "secrets.json");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("saving/clearing the YouTube key preserves the Anthropic key", async () => {
    await saveAnthropicKey("sk-ant-keep");
    await saveYouTubeKey("AIza-yt");
    expect(await getSavedAnthropicKey()).toBe("sk-ant-keep");
    await clearYouTubeKey();
    expect(await getSavedAnthropicKey()).toBe("sk-ant-keep"); // still there
    expect(await getSavedYouTubeKey()).toBeUndefined();
  });
});
