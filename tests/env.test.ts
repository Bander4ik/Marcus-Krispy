/**
 * Tests for typed env access in lib/env.ts. Uses vi.stubEnv to control vars.
 *
 * assertScriptRunnable / resolveAnthropicKey now consult the saved-key file as a
 * fallback (lib/settings/store.ts). To keep these env-only tests hermetic, we
 * point the store at a throwaway temp HOME via MARCUS_KRISPY_HOME, so no real
 * ~/.marcus-krispy/secrets.json can leak into the "unset" cases.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertScriptRunnable,
  getAnthropicKey,
  getGeminiKey,
  getScriptModel,
  getMechanicalModel,
  getScriptEngineName,
  getAppPassword,
  MissingEnvError,
} from "@/lib/env";

let tmpHome: string;

beforeEach(() => {
  // Empty temp dir => no secrets file => the saved-key fallback is empty.
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-env-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertScriptRunnable", () => {
  it("rejects with a MissingEnvError + a clear message when the key is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(assertScriptRunnable()).rejects.toThrow(MissingEnvError);
    await expect(assertScriptRunnable()).rejects.toThrow(
      /ANTHROPIC_API_KEY is not set/
    );
    // The message points to both Settings and .env.local.
    await expect(assertScriptRunnable()).rejects.toThrow(/Settings/);
    await expect(assertScriptRunnable()).rejects.toThrow(/\.env\.local/);
  });

  it("treats a whitespace-only key as unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    await expect(assertScriptRunnable()).rejects.toThrow(MissingEnvError);
  });

  it("resolves (no throw) when the key is set in the environment", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    await expect(assertScriptRunnable()).resolves.toBeUndefined();
  });
});

describe("key getters", () => {
  it("getAnthropicKey trims and returns undefined when blank", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "  sk-ant-xyz  ");
    expect(getAnthropicKey()).toBe("sk-ant-xyz");
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    expect(getAnthropicKey()).toBeUndefined();
  });

  it("getGeminiKey trims and returns undefined when blank", () => {
    vi.stubEnv("GEMINI_API_KEY", " gkey ");
    expect(getGeminiKey()).toBe("gkey");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getGeminiKey()).toBeUndefined();
  });
});

describe("model overrides", () => {
  it("getScriptModel returns the trimmed override or undefined", () => {
    vi.stubEnv("SCRIPT_MODEL", "  claude-x  ");
    expect(getScriptModel()).toBe("claude-x");
    vi.stubEnv("SCRIPT_MODEL", "");
    expect(getScriptModel()).toBeUndefined();
  });

  it("getMechanicalModel returns the trimmed override or undefined", () => {
    vi.stubEnv("MECHANICAL_MODEL", " gemini-x ");
    expect(getMechanicalModel()).toBe("gemini-x");
    vi.stubEnv("MECHANICAL_MODEL", "");
    expect(getMechanicalModel()).toBeUndefined();
  });
});

describe("getScriptEngineName", () => {
  it('defaults to "pipeline" when unset', () => {
    vi.stubEnv("SCRIPT_ENGINE", "");
    expect(getScriptEngineName()).toBe("pipeline");
  });

  it("returns the trimmed configured value", () => {
    vi.stubEnv("SCRIPT_ENGINE", "  single-shot  ");
    expect(getScriptEngineName()).toBe("single-shot");
  });
});

describe("getAppPassword", () => {
  it("returns undefined when unset and the trimmed value when set", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(getAppPassword()).toBeUndefined();
    vi.stubEnv("APP_PASSWORD", "  hunter2  ");
    expect(getAppPassword()).toBe("hunter2");
  });
});
