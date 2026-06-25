/**
 * Competitor store — the local, single-user state for the Competitors/Outliers
 * tab. Reads/writes a JSON file OUTSIDE the repo at
 * ~/.marcus-krispy/competitors.json:
 *
 *   { channels: string[]  // @handles, the seed list is editable in the UI
 *     lastScanAt: string | null  // ISO timestamp of the last completed scan
 *     outliers: Outlier[] }      // the ranked results of that scan
 *
 * Same robustness + testability contract as the secrets store: a missing/corrupt
 * file is treated as the seed defaults (channels) / empty (scan), never throws on
 * read; the home dir is resolved from MARCUS_KRISPY_HOME if set (so tests point
 * it at a temp dir) else os.homedir(). This file holds no secrets, so it is
 * written 0644 (default) — the API key lives in secrets.json (0600).
 *
 * The 12 seed channels are a deliberate MIX of golf + tennis channels running
 * the same "gear value / overpriced-vs-worth-it" format (the client's niche).
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Outlier } from "@/lib/youtube/data-api";

/** The 12 seed competitor handles (golf + tennis), editable in the UI. */
export const SEED_CHANNELS: readonly string[] = [
  // Golf
  "@RyanGolfYT",
  "@TheVeteranGolfer",
  "@GolfersHelp",
  "@TheHonestCaddy",
  "@LetsPlayThru",
  // Tennis
  "@matchpoint99",
  "@Tennisnerd",
  "@SeniorTennisUnpacked",
  "@tennisnationusa",
  "@TennCom",
  "@BrandMeter",
  "@TennisHacker",
];

/** Shape of the on-disk competitors file. */
export interface CompetitorsFile {
  channels: string[];
  lastScanAt: string | null;
  outliers: Outlier[];
}

const APP_DIR = ".marcus-krispy";
const COMPETITORS_FILE = "competitors.json";

/** Resolves the home dir, allowing an override for testability. */
function homeDir(): string {
  return process.env.MARCUS_KRISPY_HOME?.trim() || os.homedir();
}

function appDir(): string {
  return path.join(homeDir(), APP_DIR);
}

function competitorsPath(): string {
  return path.join(appDir(), COMPETITORS_FILE);
}

/** Normalizes a handle to a canonical "@name" form (adds @, trims, no spaces). */
export function normalizeHandle(raw: string): string {
  let h = raw.trim();
  if (!h) return "";
  // Accept a pasted channel URL like https://youtube.com/@Name -> @Name.
  const urlMatch = h.match(/youtube\.com\/(@[\w.-]+)/i);
  if (urlMatch) h = urlMatch[1];
  // Strip a leading @ (re-added below) and any stray whitespace.
  h = h.replace(/^@+/, "").replace(/\s+/g, "");
  if (!h) return "";
  return `@${h}`;
}

/** A fresh defaults object (seed channels, no scan yet). */
function defaults(): CompetitorsFile {
  return { channels: [...SEED_CHANNELS], lastScanAt: null, outliers: [] };
}

/** Coerces an unknown parsed value into a valid CompetitorsFile. */
function coerce(parsed: unknown): CompetitorsFile {
  if (!parsed || typeof parsed !== "object") return defaults();
  const obj = parsed as Partial<CompetitorsFile>;
  const channels = Array.isArray(obj.channels)
    ? obj.channels.filter((c): c is string => typeof c === "string")
    : [...SEED_CHANNELS];
  const lastScanAt =
    typeof obj.lastScanAt === "string" ? obj.lastScanAt : null;
  const outliers = Array.isArray(obj.outliers)
    ? (obj.outliers as Outlier[])
    : [];
  return { channels, lastScanAt, outliers };
}

/**
 * Reads the competitors file. Missing file → seed defaults (and the seeds are
 * persisted so the file exists on next read). Corrupt/partial file → coerced to
 * valid defaults for the bad fields. Never throws on read.
 */
export async function readCompetitors(): Promise<CompetitorsFile> {
  let raw: string;
  try {
    raw = await fs.readFile(competitorsPath(), "utf-8");
  } catch {
    // Missing file: seed it so the 12 channels show on first open.
    const seeded = defaults();
    await writeCompetitors(seeded);
    return seeded;
  }
  try {
    return coerce(JSON.parse(raw) as unknown);
  } catch {
    return defaults(); // corrupt JSON
  }
}

/** Writes the competitors file, creating ~/.marcus-krispy/ if needed. */
export async function writeCompetitors(data: CompetitorsFile): Promise<void> {
  await fs.mkdir(appDir(), { recursive: true, mode: 0o700 });
  await fs.writeFile(
    competitorsPath(),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

/** Returns the current channel handles (seeded on first read). */
export async function getChannels(): Promise<string[]> {
  return (await readCompetitors()).channels;
}

/**
 * Adds a channel handle (normalized). Idempotent: a duplicate (case-insensitive)
 * is ignored. Returns the updated channel list.
 */
export async function addChannel(handle: string): Promise<string[]> {
  const normalized = normalizeHandle(handle);
  if (!normalized) throw new Error("A channel handle is required.");
  const data = await readCompetitors();
  const exists = data.channels.some(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  );
  if (!exists) {
    data.channels.push(normalized);
    await writeCompetitors(data);
  }
  return data.channels;
}

/**
 * Removes a channel handle (case-insensitive match on the normalized form).
 * Returns the updated channel list.
 */
export async function removeChannel(handle: string): Promise<string[]> {
  const normalized = normalizeHandle(handle);
  const data = await readCompetitors();
  data.channels = data.channels.filter(
    (c) => c.toLowerCase() !== normalized.toLowerCase()
  );
  await writeCompetitors(data);
  return data.channels;
}

/** Saves the scan results + sets lastScanAt to now (or a provided ISO time). */
export async function saveScan(
  outliers: Outlier[],
  scannedAt: string = new Date().toISOString()
): Promise<CompetitorsFile> {
  const data = await readCompetitors();
  data.outliers = outliers;
  data.lastScanAt = scannedAt;
  await writeCompetitors(data);
  return data;
}
