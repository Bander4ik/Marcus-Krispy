/**
 * Tests for resolveAnthropicKey() precedence (lib/env.ts):
 *   - env set                  → returns the env key (file ignored)
 *   - env empty + file set      → returns the file key
 *   - neither set               → undefined (and assertScriptRunnable rejects)
 *
 * The store is pointed at a temp HOME via MARCUS_KRISPY_HOME so we control the
 * saved-file side without touching the real home dir.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAnthropicKey, assertScriptRunnable, MissingEnvError } from "@/lib/env";
import { saveAnthropicKey } from "@/lib/settings/store";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-resolve-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("resolveAnthropicKey precedence", () => {
  it("returns the env key when ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");
    expect(await resolveAnthropicKey()).toBe("sk-ant-env");
  });

  it("env wins even when a file key is also saved", async () => {
    await saveAnthropicKey("sk-ant-file");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-env");
    expect(await resolveAnthropicKey()).toBe("sk-ant-env");
  });

  it("falls back to the saved file key when the env is empty", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await saveAnthropicKey("sk-ant-file");
    expect(await resolveAnthropicKey()).toBe("sk-ant-file");
  });

  it("treats a whitespace-only env key as empty and uses the file key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    await saveAnthropicKey("sk-ant-file");
    expect(await resolveAnthropicKey()).toBe("sk-ant-file");
  });

  it("returns undefined when neither env nor file is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await resolveAnthropicKey()).toBeUndefined();
  });

  it("assertScriptRunnable rejects when neither is set, resolves when the file key exists", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(assertScriptRunnable()).rejects.toThrow(MissingEnvError);
    await saveAnthropicKey("sk-ant-file");
    await expect(assertScriptRunnable()).resolves.toBeUndefined();
  });
});
