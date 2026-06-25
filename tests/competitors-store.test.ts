/**
 * Tests for the competitor store (lib/competitors/store.ts). Like the secrets
 * store, every test points MARCUS_KRISPY_HOME at a fresh temp dir so the real
 * ~/.marcus-krispy/competitors.json is never touched.
 *
 * Coverage: seed-on-missing, normalizeHandle, add/remove (idempotent, case-
 * insensitive, URL paste), saveScan (sets lastScanAt + outliers), corrupt-file
 * robustness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readCompetitors,
  getChannels,
  addChannel,
  removeChannel,
  saveScan,
  normalizeHandle,
  SEED_CHANNELS,
} from "@/lib/competitors/store";
import type { Outlier } from "@/lib/youtube/data-api";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-competitors-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

function competitorsFile(): string {
  return path.join(tmpHome, ".marcus-krispy", "competitors.json");
}

describe("normalizeHandle", () => {
  it("adds a leading @ and trims", () => {
    expect(normalizeHandle("  matchpoint99 ")).toBe("@matchpoint99");
  });
  it("keeps an existing @ (no doubling)", () => {
    expect(normalizeHandle("@Tennisnerd")).toBe("@Tennisnerd");
    expect(normalizeHandle("@@weird")).toBe("@weird");
  });
  it("extracts the handle from a channel URL", () => {
    expect(normalizeHandle("https://www.youtube.com/@RyanGolfYT")).toBe("@RyanGolfYT");
  });
  it("returns empty string for blank input", () => {
    expect(normalizeHandle("   ")).toBe("");
  });
});

describe("seed on missing file", () => {
  it("seeds the 12 channels on first read and persists the file", async () => {
    expect(existsSync(competitorsFile())).toBe(false);
    const data = await readCompetitors();
    expect(data.channels).toEqual([...SEED_CHANNELS]);
    expect(data.channels).toHaveLength(12);
    expect(data.lastScanAt).toBeNull();
    expect(data.outliers).toEqual([]);
    // The file now exists (seeded write-through).
    expect(existsSync(competitorsFile())).toBe(true);
  });

  it("getChannels returns the seeds on first call", async () => {
    expect(await getChannels()).toEqual([...SEED_CHANNELS]);
  });
});

describe("add / remove channels", () => {
  it("adds a new channel (normalized)", async () => {
    const channels = await addChannel("freshChannel");
    expect(channels).toContain("@freshChannel");
    expect(await getChannels()).toContain("@freshChannel");
  });

  it("is idempotent — adding a duplicate (any case) does not double it", async () => {
    await addChannel("@DupChan");
    const after = await addChannel("@dupchan");
    expect(after.filter((c) => c.toLowerCase() === "@dupchan").length).toBe(1);
  });

  it("removes a channel case-insensitively", async () => {
    await addChannel("@ToRemove");
    const after = await removeChannel("@toremove");
    expect(after).not.toContain("@ToRemove");
  });

  it("removing a seed channel works", async () => {
    await readCompetitors(); // seed
    const after = await removeChannel("@Tennisnerd");
    expect(after).not.toContain("@Tennisnerd");
    expect(after).toHaveLength(11);
  });

  it("throws when adding a blank handle", async () => {
    await expect(addChannel("   ")).rejects.toThrow();
  });
});

describe("saveScan", () => {
  const outlier: Outlier = {
    videoId: "vid1",
    title: "An over-performer",
    channelHandle: "@matchpoint99",
    views: 500_000,
    multiple: 4.2,
    publishedAt: "2026-06-20T00:00:00Z",
    videoUrl: "https://www.youtube.com/watch?v=vid1",
    ageDays: 5,
  };

  it("saves outliers and sets lastScanAt", async () => {
    const fixed = "2026-06-25T12:00:00.000Z";
    const data = await saveScan([outlier], fixed);
    expect(data.lastScanAt).toBe(fixed);
    expect(data.outliers).toEqual([outlier]);
    // Persisted: a fresh read sees them.
    const reread = await readCompetitors();
    expect(reread.outliers).toEqual([outlier]);
    expect(reread.lastScanAt).toBe(fixed);
  });

  it("defaults lastScanAt to ~now when not provided", async () => {
    const before = Date.now();
    const data = await saveScan([]);
    const ts = Date.parse(data.lastScanAt!);
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
  });

  it("preserves the channel list across a scan", async () => {
    await addChannel("@KeepMe");
    await saveScan([outlier]);
    expect(await getChannels()).toContain("@KeepMe");
  });
});

describe("robust against a corrupt file", () => {
  it("treats corrupt JSON as defaults (seed channels, no scan)", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(competitorsFile(), "{ not json", "utf-8");
    const data = await readCompetitors();
    expect(data.channels).toEqual([...SEED_CHANNELS]);
    expect(data.outliers).toEqual([]);
  });

  it("coerces a partial object (missing fields) to valid defaults", async () => {
    mkdirSync(path.join(tmpHome, ".marcus-krispy"), { recursive: true });
    writeFileSync(
      competitorsFile(),
      JSON.stringify({ channels: ["@only"] }),
      "utf-8"
    );
    const data = await readCompetitors();
    expect(data.channels).toEqual(["@only"]);
    expect(data.lastScanAt).toBeNull();
    expect(data.outliers).toEqual([]);
  });
});
