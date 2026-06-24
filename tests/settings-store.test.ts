/**
 * Tests for the server-side secrets store (lib/settings/store.ts).
 *
 * The store reads/writes ~/.marcus-krispy/secrets.json. To avoid touching the
 * real home dir, every test points MARCUS_KRISPY_HOME at a fresh temp dir (the
 * store honors that override for exactly this reason) and removes it after.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getSavedAnthropicKey,
  saveAnthropicKey,
  clearAnthropicKey,
  getSavedScriptModel,
} from "@/lib/settings/store";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-store-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

/** The on-disk secrets file for the current temp home. */
function secretsFile(): string {
  return path.join(tmpHome, ".marcus-krispy", "secrets.json");
}

describe("secrets store — save → get → clear round-trip", () => {
  it("returns undefined when nothing is saved (no file yet)", async () => {
    expect(await getSavedAnthropicKey()).toBeUndefined();
  });

  it("saves then reads the key back", async () => {
    await saveAnthropicKey("sk-ant-abc123");
    expect(await getSavedAnthropicKey()).toBe("sk-ant-abc123");
  });

  it("trims the key on save", async () => {
    await saveAnthropicKey("  sk-ant-spaces  ");
    expect(await getSavedAnthropicKey()).toBe("sk-ant-spaces");
  });

  it("clear removes the saved key", async () => {
    await saveAnthropicKey("sk-ant-toremove");
    expect(await getSavedAnthropicKey()).toBe("sk-ant-toremove");
    await clearAnthropicKey();
    expect(await getSavedAnthropicKey()).toBeUndefined();
  });

  it("writes the secrets file with 0600 permissions", async () => {
    await saveAnthropicKey("sk-ant-perm");
    const mode = statSync(secretsFile()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("creates the ~/.marcus-krispy dir if missing", async () => {
    await saveAnthropicKey("sk-ant-dir");
    const dirMode = statSync(path.join(tmpHome, ".marcus-krispy")).isDirectory();
    expect(dirMode).toBe(true);
  });
});

describe("secrets store — robust against missing / corrupt files", () => {
  it("treats a corrupt JSON file as empty (does not throw)", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(secretsFile(), "{ not valid json", "utf-8");
    expect(await getSavedAnthropicKey()).toBeUndefined();
  });

  it("treats a non-object JSON file as empty", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(secretsFile(), "\"just a string\"", "utf-8");
    expect(await getSavedAnthropicKey()).toBeUndefined();
  });

  it("treats a blank saved key as unset", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(secretsFile(), JSON.stringify({ anthropicKey: "   " }), "utf-8");
    expect(await getSavedAnthropicKey()).toBeUndefined();
  });
});

describe("secrets store — preserves other settings + scriptModel", () => {
  it("clearing the key keeps a saved scriptModel intact", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(
      secretsFile(),
      JSON.stringify({ anthropicKey: "sk-ant-x", scriptModel: "claude-opus-4-8" }),
      "utf-8"
    );
    await clearAnthropicKey();
    expect(await getSavedAnthropicKey()).toBeUndefined();
    expect(await getSavedScriptModel()).toBe("claude-opus-4-8");
  });

  it("saving the key keeps a saved scriptModel intact", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(
      secretsFile(),
      JSON.stringify({ scriptModel: "claude-opus-4-8" }),
      "utf-8"
    );
    await saveAnthropicKey("sk-ant-new");
    expect(await getSavedAnthropicKey()).toBe("sk-ant-new");
    expect(await getSavedScriptModel()).toBe("claude-opus-4-8");
  });

  it("getSavedScriptModel returns undefined when unset", async () => {
    await saveAnthropicKey("sk-ant-only");
    expect(await getSavedScriptModel()).toBeUndefined();
  });
});
