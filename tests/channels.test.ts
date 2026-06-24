/**
 * Tests for the channel loader (lib/channels/channels.ts). Reads the REAL
 * channels/tennistimez files from disk (no API key needed) and checks the
 * tolerant behavior for missing channels/prompts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadChannel, listChannels } from "@/lib/channels/channels";

const ROOT = process.cwd();
const PROMPT_DIR = path.join(ROOT, "channels/tennistimez/prompts");

describe("loadChannel('tennistimez')", () => {
  it("loads metadata from channel.json", async () => {
    const ch = await loadChannel("tennistimez");
    expect(ch.id).toBe("tennistimez");
    expect(ch.name).toContain("TennisTimez");
    expect(ch.task).toBe("script-writing");
    expect(ch.finalLabel).toBe("Script.md");
    expect(ch.placeholder).toBe(true);
  });

  it("loads the system prompt and voice fingerprint text", async () => {
    const ch = await loadChannel("tennistimez");
    expect(ch.systemPrompt.length).toBeGreaterThan(0);
    expect(ch.voiceFingerprint.length).toBeGreaterThan(0);
  });

  it("exposes the 3 staged pipeline prompts, matching the files on disk", async () => {
    const ch = await loadChannel("tennistimez");
    expect(ch.prompts).toBeDefined();

    const step1 = readFileSync(path.join(PROMPT_DIR, "step1_research.md"), "utf-8");
    const step2 = readFileSync(path.join(PROMPT_DIR, "step2_script.md"), "utf-8");
    const audit = readFileSync(path.join(PROMPT_DIR, "fact_audit.md"), "utf-8");

    expect(ch.prompts!.step1Research).toBe(step1);
    expect(ch.prompts!.step2Script).toBe(step2);
    expect(ch.prompts!.factAudit).toBe(audit);

    // Sanity: the prompts carry their expected scaffolding.
    expect(ch.prompts!.step1Research).toContain("INPUT TEMPLATE");
    expect(ch.prompts!.step2Script).toContain("<story_structure>");
    expect(ch.prompts!.factAudit).toContain("PHASE 1");
  });
});

describe("loadChannel — missing channel", () => {
  it("rejects when the channel.json does not exist", async () => {
    await expect(loadChannel("does-not-exist-xyz")).rejects.toBeTruthy();
  });
});

describe("listChannels", () => {
  it("includes tennistimez in the summaries", async () => {
    const list = await listChannels();
    const tt = list.find((c) => c.id === "tennistimez");
    expect(tt).toBeDefined();
    expect(tt!.placeholder).toBe(true);
  });
});
