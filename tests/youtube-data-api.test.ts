/**
 * Tests for lib/youtube/data-api.ts — the outlier math (pure, no network) and
 * the fetch layer (network mocked via vi.stubGlobal("fetch", …)). NO real
 * YouTube calls are made.
 *
 * Coverage:
 *   - median (odd/even/empty)
 *   - detectOutliers: threshold boundary (== is inclusive), all-equal → none,
 *     too-few-uploads → none, zero-median → none, age annotation
 *   - rankScore age-awareness (newer outlier sorts above an equal-multiple older)
 *   - rankAndCap ranking + cap (top-N, logs when truncated)
 *   - resolveChannel: handle → channelId + uploads playlist (forHandle), null on miss
 *   - listRecentUploadIds / fetchVideoStats happy paths
 *   - findOutliers end-to-end (mocked) and scanAll aggregation/ranking/cap +
 *     per-channel error capture + missing-key throw
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  median,
  ageInDays,
  rankScore,
  detectOutliers,
  rankAndCap,
  resolveChannel,
  listRecentUploadIds,
  fetchVideoStats,
  findOutliers,
  scanAll,
  OUTLIER_THRESHOLD,
  MAX_OUTLIERS,
  type VideoStat,
  type Outlier,
} from "@/lib/youtube/data-api";
import { MissingEnvError } from "@/lib/env";

const NOW = Date.parse("2026-06-25T00:00:00Z");

/** Builds a VideoStat with a publishedAt `daysAgo` before NOW. */
function stat(
  videoId: string,
  views: number,
  daysAgo = 100,
  title = `v-${videoId}`
): VideoStat {
  return {
    videoId,
    views,
    title,
    publishedAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  };
}

describe("median", () => {
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });
  it("returns the middle of an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middles of an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("does not mutate the input", () => {
    const input = [5, 1, 3];
    median(input);
    expect(input).toEqual([5, 1, 3]);
  });
});

describe("ageInDays", () => {
  it("computes whole days and clamps negatives (future date) to 0", () => {
    expect(ageInDays(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe(3);
    expect(ageInDays(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
  });
  it("returns 0 for an unparseable date", () => {
    expect(ageInDays("not-a-date", NOW)).toBe(0);
  });
});

describe("detectOutliers — core metric (views vs channel median)", () => {
  // Baseline channel: 5 uploads, median 100.
  const base = [
    stat("a", 100),
    stat("b", 100),
    stat("c", 100),
    stat("d", 100),
    stat("e", 100),
  ];

  it("flags a video at exactly the threshold boundary (>= is inclusive)", () => {
    const stats = [...base, stat("hit", 300)]; // 300 == 100 * 3
    const out = detectOutliers("@c", stats, { now: NOW });
    expect(out.map((o) => o.videoId)).toContain("hit");
    const hit = out.find((o) => o.videoId === "hit")!;
    expect(hit.multiple).toBe(3);
  });

  it("does NOT flag a video just below the threshold", () => {
    const stats = [...base, stat("near", 299)]; // 2.99×, below 3×
    const out = detectOutliers("@c", stats, { now: NOW });
    expect(out.map((o) => o.videoId)).not.toContain("near");
  });

  it("returns no outliers when all views are equal (median == each view)", () => {
    const out = detectOutliers("@c", base, { now: NOW });
    expect(out).toEqual([]);
  });

  it("returns [] when there are too few uploads for a stable median", () => {
    const tooFew = [stat("a", 100), stat("b", 1000)]; // only 2 < MIN(5)
    expect(detectOutliers("@c", tooFew, { now: NOW })).toEqual([]);
  });

  it("returns [] when the median is zero (all-zero views)", () => {
    const zeros = [
      stat("a", 0),
      stat("b", 0),
      stat("c", 0),
      stat("d", 0),
      stat("e", 0),
    ];
    expect(detectOutliers("@c", zeros, { now: NOW })).toEqual([]);
  });

  it("annotates each outlier with views, multiple (1dp), url, handle, age", () => {
    const stats = [...base, stat("big", 540, 10)]; // 5.4×, 10 days old
    const out = detectOutliers("@chan", stats, { now: NOW });
    const big = out.find((o) => o.videoId === "big")!;
    expect(big).toMatchObject({
      channelHandle: "@chan",
      views: 540,
      multiple: 5.4,
      videoUrl: "https://www.youtube.com/watch?v=big",
      ageDays: 10,
    });
  });

  it("respects a custom threshold", () => {
    const stats = [...base, stat("two", 200)]; // 2× — outlier only if threshold<=2
    expect(
      detectOutliers("@c", stats, { now: NOW, threshold: 2 }).map((o) => o.videoId)
    ).toContain("two");
    expect(
      detectOutliers("@c", stats, { now: NOW, threshold: 3 }).map((o) => o.videoId)
    ).not.toContain("two");
  });

  it("uses OUTLIER_THRESHOLD (3) as the default", () => {
    expect(OUTLIER_THRESHOLD).toBe(3);
  });
});

describe("rankScore — age-aware ordering (does not create outliers)", () => {
  it("boosts a brand-new video above an equal-multiple old one", () => {
    const fresh = rankScore(4, 0); // today
    const old = rankScore(4, 365); // a year old
    expect(fresh).toBeGreaterThan(old);
  });

  it("leaves the score unchanged once outside the recency window", () => {
    expect(rankScore(4, 60)).toBe(4);
  });

  it("a much bigger multiple still beats a slightly-fresher smaller one", () => {
    // 8× a month old should outrank 4× today (boost is capped well under 2×).
    expect(rankScore(8, 30)).toBeGreaterThan(rankScore(4, 0));
  });
});

describe("rankAndCap — aggregate ranking + cap", () => {
  function mk(id: string, multiple: number, ageDays = 100): Outlier {
    return {
      videoId: id,
      title: id,
      channelHandle: "@x",
      views: multiple * 100,
      multiple,
      publishedAt: new Date(NOW - ageDays * 86_400_000).toISOString(),
      videoUrl: `https://www.youtube.com/watch?v=${id}`,
      ageDays,
    };
  }

  it("sorts strongest-first by the age-aware score", () => {
    const ranked = rankAndCap([mk("a", 3), mk("b", 9), mk("c", 5)]);
    expect(ranked.map((o) => o.videoId)).toEqual(["b", "c", "a"]);
  });

  it("caps to the requested max and logs when truncating", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const many = Array.from({ length: 50 }, (_, i) => mk(`v${i}`, 50 - i));
    const ranked = rankAndCap(many, 40);
    expect(ranked).toHaveLength(40);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/truncating to top 40/));
    log.mockRestore();
  });

  it("defaults the cap to MAX_OUTLIERS (40)", () => {
    expect(MAX_OUTLIERS).toBe(40);
    const many = Array.from({ length: 45 }, (_, i) => mk(`v${i}`, 45 - i));
    expect(rankAndCap(many)).toHaveLength(40);
  });
});

// ---- Network layer (mocked fetch) -----------------------------------------

/** Builds a Response-like object for the mocked fetch. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("resolveChannel — handle → channelId + uploads playlist", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resolves the channel id + uploads playlist from forHandle", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "UC_chan123",
            contentDetails: { relatedPlaylists: { uploads: "UU_chan123" } },
          },
        ],
      })
    );
    const res = await resolveChannel("@SomeChannel", "KEY");
    expect(res).toEqual({
      channelId: "UC_chan123",
      uploadsPlaylistId: "UU_chan123",
    });
    // Quota-efficient: uses channels.list (forHandle), not search.list.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/channels?");
    expect(url).toContain("forHandle=SomeChannel"); // leading @ stripped
    expect(url).not.toContain("/search");
    expect(url).toContain("key=KEY");
  });

  it("returns null when the handle resolves to no items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    expect(await resolveChannel("@ghost", "KEY")).toBeNull();
  });

  it("throws YouTubeApiError on an API error (e.g. keyInvalid)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "API key not valid", errors: [{ reason: "keyInvalid" }] } },
        false,
        400
      )
    );
    await expect(resolveChannel("@x", "BAD")).rejects.toThrow(/keyInvalid|not valid/);
  });
});

describe("listRecentUploadIds + fetchVideoStats", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists upload ids from the uploads playlist (one page)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { contentDetails: { videoId: "v1" } },
          { contentDetails: { videoId: "v2" } },
        ],
      })
    );
    const ids = await listRecentUploadIds("UU_x", "KEY", 30);
    expect(ids).toEqual(["v1", "v2"]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/playlistItems?");
    expect(url).toContain("playlistId=UU_x");
  });

  it("fetches stats and skips videos without a numeric viewCount", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "v1",
            snippet: { title: "T1", publishedAt: "2026-06-01T00:00:00Z" },
            statistics: { viewCount: "1234" },
          },
          {
            id: "v2",
            snippet: { title: "Hidden", publishedAt: "2026-06-02T00:00:00Z" },
            statistics: {}, // no viewCount → skipped
          },
        ],
      })
    );
    const stats = await fetchVideoStats(["v1", "v2"], "KEY");
    expect(stats).toEqual([
      {
        videoId: "v1",
        title: "T1",
        views: 1234,
        publishedAt: "2026-06-01T00:00:00Z",
      },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/videos?");
    expect(url).toContain("part=snippet%2Cstatistics");
  });
});

describe("findOutliers (mocked end-to-end) + scanAll", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Queues the 3-call sequence for one channel: resolve → playlist → videos. */
  function queueChannel(
    uploads: string,
    videos: Array<{ id: string; views: number; daysAgo?: number }>
  ) {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ id: "UC", contentDetails: { relatedPlaylists: { uploads } } }],
      })
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: videos.map((v) => ({ contentDetails: { videoId: v.id } })),
      })
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: videos.map((v) => ({
          id: v.id,
          snippet: {
            title: `title-${v.id}`,
            publishedAt: new Date(
              NOW - (v.daysAgo ?? 100) * 86_400_000
            ).toISOString(),
          },
          statistics: { viewCount: String(v.views) },
        })),
      })
    );
  }

  it("finds a channel's outlier end-to-end", async () => {
    queueChannel("UU_a", [
      { id: "a1", views: 100 },
      { id: "a2", views: 100 },
      { id: "a3", views: 100 },
      { id: "a4", views: 100 },
      { id: "a5", views: 100 },
      { id: "spike", views: 600 }, // 6× median
    ]);
    const out = await findOutliers("@a", "KEY", { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ videoId: "spike", multiple: 6, channelHandle: "@a" });
  });

  it("returns [] (and does not throw) when a handle can't be resolved", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    expect(await findOutliers("@ghost", "KEY", { now: NOW })).toEqual([]);
    log.mockRestore();
  });

  it("scanAll aggregates across channels, ranks, and caps", async () => {
    // Channel A: one 4× outlier. Channel B: one 8× outlier (should rank first).
    queueChannel("UU_a", [
      { id: "a1", views: 100 },
      { id: "a2", views: 100 },
      { id: "a3", views: 100 },
      { id: "a4", views: 100 },
      { id: "a5", views: 100 },
      { id: "a_out", views: 400, daysAgo: 100 },
    ]);
    queueChannel("UU_b", [
      { id: "b1", views: 50 },
      { id: "b2", views: 50 },
      { id: "b3", views: 50 },
      { id: "b4", views: 50 },
      { id: "b5", views: 50 },
      { id: "b_out", views: 400, daysAgo: 100 }, // 8×
    ]);
    const { outliers, errors } = await scanAll(["@a", "@b"], "KEY", {
      now: NOW,
      max: 5,
    });
    expect(errors).toEqual([]);
    expect(outliers.map((o) => o.videoId)).toEqual(["b_out", "a_out"]);
  });

  it("scanAll records a per-channel error and continues with the rest", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    // Channel A throws on resolve (e.g. transient 500).
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "boom" } }, false, 500)
    );
    // Channel B succeeds with one outlier.
    queueChannel("UU_b", [
      { id: "b1", views: 100 },
      { id: "b2", views: 100 },
      { id: "b3", views: 100 },
      { id: "b4", views: 100 },
      { id: "b5", views: 100 },
      { id: "b_out", views: 500 },
    ]);
    const { outliers, errors } = await scanAll(["@a", "@b"], "KEY", { now: NOW });
    expect(errors).toHaveLength(1);
    expect(errors[0].handle).toBe("@a");
    expect(outliers.map((o) => o.videoId)).toEqual(["b_out"]);
    log.mockRestore();
  });

  it("scanAll throws MissingEnvError when the key is empty", async () => {
    await expect(scanAll(["@a"], "")).rejects.toThrow(MissingEnvError);
  });
});
