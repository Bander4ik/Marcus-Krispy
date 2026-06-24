/**
 * Pure + guard-path tests for the model router and the Gemini wrapper's no-key
 * guard. None of these require a live API key.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { pickModel } from "@/lib/models/router";
import { runGemini } from "@/lib/models/gemini";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pickModel", () => {
  it("returns the Anthropic Sonnet default for script-writing", () => {
    vi.stubEnv("SCRIPT_MODEL", "");
    expect(pickModel("script-writing")).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
  });

  it("returns the Gemini default for mechanical", () => {
    vi.stubEnv("MECHANICAL_MODEL", "");
    expect(pickModel("mechanical")).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("applies SCRIPT_MODEL override while keeping the Anthropic provider", () => {
    vi.stubEnv("SCRIPT_MODEL", "claude-opus-4-6");
    expect(pickModel("script-writing")).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-6",
    });
  });

  it("applies MECHANICAL_MODEL override while keeping the Gemini provider", () => {
    vi.stubEnv("MECHANICAL_MODEL", "gemini-3.1-flash-lite");
    expect(pickModel("mechanical")).toEqual({
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
    });
  });

  it("ignores the wrong override (mechanical override does not affect script)", () => {
    vi.stubEnv("MECHANICAL_MODEL", "gemini-x");
    vi.stubEnv("SCRIPT_MODEL", "");
    expect(pickModel("script-writing").model).toBe("claude-sonnet-4-6");
  });
});

describe("runGemini — no-key guard", () => {
  it("throws a clear error when GEMINI_API_KEY is unset (no network)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(runGemini({ prompt: "hi" })).rejects.toThrow(
      /GEMINI_API_KEY is not set/
    );
  });
});
