/**
 * Route-handler tests for /api/competitors/scan (GET + POST). The store is
 * pointed at a temp HOME; the YouTube network layer (scanAll) is mocked so NO
 * real YouTube call is made.
 *
 * Focus:
 *   - POST with NO key → graceful 400 JSON (never throws / 500), mentions Settings
 *   - POST happy path (mocked scanAll) → 200, saves outliers + lastScanAt
 *   - GET → the current saved state (channels seeded, lastScanAt, outliers)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Outlier, ScanResult } from "@/lib/youtube/data-api";

let tmpHome: string;

// Mock the YouTube data layer so the route never hits the network.
const scanAllMock = vi.fn<(...args: unknown[]) => Promise<ScanResult>>();
vi.mock("@/lib/youtube/data-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/youtube/data-api")>();
  return { ...actual, scanAll: (...args: unknown[]) => scanAllMock(...args) };
});

const { GET, POST } = await import("@/app/api/competitors/scan/route");

const SAMPLE_OUTLIER: Outlier = {
  videoId: "vidX",
  title: "5 golf brands robbing you blind",
  channelHandle: "@RyanGolfYT",
  views: 320_000,
  multiple: 4.7,
  publishedAt: "2026-06-18T00:00:00Z",
  videoUrl: "https://www.youtube.com/watch?v=vidX",
  ageDays: 7,
};

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(os.tmpdir(), "mk-scan-route-"));
  vi.stubEnv("MARCUS_KRISPY_HOME", tmpHome);
  vi.stubEnv("YOUTUBE_DATA_API_KEY", "");
  scanAllMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("POST /api/competitors/scan — missing key", () => {
  it("returns 400 JSON {error} mentioning Settings (no key set)", async () => {
    const res = await POST();
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    const data = (await res.json()) as { error: string };
    expect(data.error).toMatch(/YouTube Data API key/i);
    expect(data.error).toMatch(/Settings/);
    // The network layer is never invoked without a key.
    expect(scanAllMock).not.toHaveBeenCalled();
  });

  it("does NOT throw / return 500 when the key is missing", async () => {
    const res = await POST();
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });
});

describe("POST /api/competitors/scan — happy path (mocked scanAll)", () => {
  it("runs scanAll over the seeded channels, saves results, returns 200", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "AIza-test-key");
    scanAllMock.mockResolvedValue({ outliers: [SAMPLE_OUTLIER], errors: [] });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      channels: string[];
      lastScanAt: string | null;
      outliers: Outlier[];
      errors: unknown[];
    };
    expect(data.outliers).toEqual([SAMPLE_OUTLIER]);
    expect(data.lastScanAt).toBeTruthy();
    // Seeded 12 channels were passed to scanAll.
    expect(scanAllMock).toHaveBeenCalledTimes(1);
    const handlesArg = scanAllMock.mock.calls[0][0] as string[];
    expect(handlesArg).toHaveLength(12);
    expect(handlesArg).toContain("@RyanGolfYT");

    // The save persisted: a subsequent GET reflects it.
    const getData = (await (await GET()).json()) as {
      lastScanAt: string | null;
      outliers: Outlier[];
    };
    expect(getData.outliers).toEqual([SAMPLE_OUTLIER]);
    expect(getData.lastScanAt).toBe(data.lastScanAt);
  });

  it("surfaces per-channel scan errors in the response", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "AIza-test-key");
    scanAllMock.mockResolvedValue({
      outliers: [],
      errors: [{ handle: "@ghost", message: "could not resolve" }],
    });
    const res = await POST();
    const data = (await res.json()) as {
      errors: Array<{ handle: string }>;
    };
    expect(data.errors[0].handle).toBe("@ghost");
  });

  it("returns 500 JSON if scanAll throws unexpectedly", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "AIza-test-key");
    scanAllMock.mockRejectedValue(new Error("network exploded"));
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/network exploded/);
  });
});

describe("GET /api/competitors/scan — current state", () => {
  it("returns the seeded channels + null lastScan before any scan", async () => {
    const data = (await (await GET()).json()) as {
      channels: string[];
      lastScanAt: string | null;
      outliers: Outlier[];
    };
    expect(data.channels).toHaveLength(12);
    expect(data.lastScanAt).toBeNull();
    expect(data.outliers).toEqual([]);
  });
});
