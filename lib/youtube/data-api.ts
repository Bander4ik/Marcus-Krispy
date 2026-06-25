/**
 * YouTube Data API v3 — competitor channel scanning + outlier detection.
 *
 * Public data only: key-based (no OAuth, no user data), raw `fetch` against
 * https://www.googleapis.com/youtube/v3. Powers the Competitors/Outliers tab.
 *
 * OUTLIER DEFINITION (client spec): a video is an outlier when its views are
 * notably above THAT channel's USUAL views — NOT raw views. "Usual" = the median
 * of the channel's recent uploads. A video is flagged when
 *   views >= median * OUTLIER_THRESHOLD   (default 3×).
 * The "multiple" we report is views / median (e.g. 3.4 = "3.4× usual"). We are
 * age-aware: a very recent video that's already an outlier gets a small boost to
 * its sort rank (younger over-performers are the strongest signal), but the core
 * metric stays views-vs-channel-median so the boost never *creates* an outlier.
 *
 * QUOTA NOTE (YouTube Data API daily quota is 10,000 units by default):
 *   - channels.list (forHandle)      = 1 unit  → resolve handle → channelId + uploads playlist
 *   - playlistItems.list (≤50)       = 1 unit  → recent upload video ids (NEWEST first)
 *   - videos.list (≤50 ids/batch)    = 1 unit  → viewCount + publishedAt + title
 * We deliberately AVOID search.list (100 units/call). Per channel that's ~3 units
 * (one playlistItems page + one videos batch of up to 50), so all 12 seed
 * channels cost ~36 units — a tiny fraction of the daily quota.
 */
import { MissingEnvError } from "@/lib/env";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/** How many recent uploads to sample per channel for the median baseline. */
export const RECENT_UPLOADS_SAMPLE = 30;

/** A video's views must be ≥ this multiple of the channel median to be an outlier. */
export const OUTLIER_THRESHOLD = 3;

/** Channels with fewer than this many sampled uploads are skipped (median noisy). */
export const MIN_UPLOADS_FOR_MEDIAN = 5;

/** Cap on the aggregated outlier list returned by scanAll (top-N by rank). */
export const MAX_OUTLIERS = 40;

/** "Recent" window (days) used by the age-aware ranking boost. */
const RECENCY_BOOST_WINDOW_DAYS = 14;
/** Max multiplicative boost applied to a brand-new outlier's sort score. */
const RECENCY_BOOST_MAX = 0.5; // up to +50% to the *rank score* only

/** A single competitor video, as fetched + flagged. */
export interface Outlier {
  videoId: string;
  title: string;
  channelHandle: string;
  views: number;
  /** views / channel-median, rounded to 1 decimal (e.g. 3.4). */
  multiple: number;
  publishedAt: string; // ISO
  videoUrl: string;
  /** Age of the video in whole days at scan time (for the UI badge + ranking). */
  ageDays: number;
}

/** Minimal stats for one video, used to compute the median + flag outliers. */
export interface VideoStat {
  videoId: string;
  title: string;
  views: number;
  publishedAt: string; // ISO
}

// ----------------------------------------------------------------------------
// Pure helpers (no network) — these carry the outlier math and are unit-tested.
// ----------------------------------------------------------------------------

/** Median of a numeric list. Empty → 0. Sorts a copy (does not mutate input). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Whole days between an ISO date and `now` (clamped at 0). */
export function ageInDays(publishedAt: string, now: number = Date.now()): number {
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0;
  const days = Math.floor((now - t) / 86_400_000);
  return days < 0 ? 0 : days;
}

/**
 * Age-aware RANK score for an outlier. Starts from the raw multiple, then adds a
 * small boost the newer the video is (linear decay across the recency window).
 * This only changes ORDERING — a video is never an outlier because of its age,
 * only because its `multiple` already cleared the threshold.
 */
export function rankScore(multiple: number, ageDays: number): number {
  if (ageDays >= RECENCY_BOOST_WINDOW_DAYS) return multiple;
  const recency = 1 - ageDays / RECENCY_BOOST_WINDOW_DAYS; // 1 (today) → 0 (window edge)
  return multiple * (1 + RECENCY_BOOST_MAX * recency);
}

/**
 * Computes the channel's median recent views and returns the videos whose views
 * are ≥ median * threshold, each annotated with its multiple + age. Pure: takes
 * the already-fetched stats so it's fully unit-testable without network.
 *
 *   - All-equal views → median == each view → multiple == 1 → no outliers.
 *   - A view exactly AT the threshold boundary (views == median*threshold) IS an
 *     outlier (>= is inclusive).
 *   - Channels with too few uploads (< MIN_UPLOADS_FOR_MEDIAN) → [] (noisy median).
 *   - A zero/Nonpositive median (e.g. all views 0) → [] (no meaningful baseline).
 */
export function detectOutliers(
  channelHandle: string,
  stats: VideoStat[],
  options: { threshold?: number; now?: number } = {}
): Outlier[] {
  const threshold = options.threshold ?? OUTLIER_THRESHOLD;
  const now = options.now ?? Date.now();

  if (stats.length < MIN_UPLOADS_FOR_MEDIAN) return [];
  const med = median(stats.map((s) => s.views));
  if (med <= 0) return [];

  const out: Outlier[] = [];
  for (const s of stats) {
    if (s.views >= med * threshold) {
      out.push({
        videoId: s.videoId,
        title: s.title,
        channelHandle,
        views: s.views,
        multiple: Math.round((s.views / med) * 10) / 10,
        publishedAt: s.publishedAt,
        videoUrl: `https://www.youtube.com/watch?v=${s.videoId}`,
        ageDays: ageInDays(s.publishedAt, now),
      });
    }
  }
  // Within a channel, strongest (age-aware) first.
  out.sort((a, b) => rankScore(b.multiple, b.ageDays) - rankScore(a.multiple, a.ageDays));
  return out;
}

/**
 * Ranks + caps an aggregated outlier list (across channels). Sorts by the
 * age-aware rank score (desc) and truncates to `max`. Logs when truncated.
 */
export function rankAndCap(
  outliers: Outlier[],
  max: number = MAX_OUTLIERS
): Outlier[] {
  const ranked = [...outliers].sort(
    (a, b) =>
      rankScore(b.multiple, b.ageDays) - rankScore(a.multiple, a.ageDays)
  );
  if (ranked.length > max) {
    console.log(
      `[competitors] ${ranked.length} outliers found across channels; truncating to top ${max}.`
    );
    return ranked.slice(0, max);
  }
  return ranked;
}

// ----------------------------------------------------------------------------
// Network layer — raw fetch against the YouTube Data API v3 (key-based).
// ----------------------------------------------------------------------------

/** Thrown when the YouTube API responds with an error (surfaced to the route). */
export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

interface ChannelResolution {
  channelId: string;
  uploadsPlaylistId: string;
}

/** Builds a v3 URL with the key + params (key is in the query per the API spec). */
function apiUrl(
  path: string,
  params: Record<string, string>,
  key: string
): string {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  return url.toString();
}

/** GETs a v3 endpoint and parses JSON, mapping HTTP errors to YouTubeApiError. */
async function apiGet<T>(
  path: string,
  params: Record<string, string>,
  key: string
): Promise<T> {
  const res = await fetch(apiUrl(path, params, key));
  if (!res.ok) {
    // Try to surface the API's reason (e.g. quotaExceeded, keyInvalid) WITHOUT
    // leaking the key (the key is only in the URL query, never echoed here).
    let detail = "";
    try {
      const body = (await res.json()) as {
        error?: { message?: string; errors?: Array<{ reason?: string }> };
      };
      const reason = body.error?.errors?.[0]?.reason;
      detail = body.error?.message || reason || "";
    } catch {
      /* non-JSON error body */
    }
    throw new YouTubeApiError(
      `YouTube API ${path} failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}.`,
      res.status
    );
  }
  return (await res.json()) as T;
}

interface ChannelsListResponse {
  items?: Array<{
    id: string;
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

/**
 * Resolves a channel @handle → its channelId + uploads-playlist id, in ONE call
 * (channels.list with forHandle, 1 quota unit). Returns null if the handle isn't
 * found (so the scan skips it rather than failing the whole run).
 */
export async function resolveChannel(
  handle: string,
  key: string
): Promise<ChannelResolution | null> {
  // The API's forHandle wants the bare handle WITHOUT the leading @.
  const forHandle = handle.replace(/^@+/, "");
  const data = await apiGet<ChannelsListResponse>(
    "channels",
    { part: "contentDetails", forHandle },
    key
  );
  const item = data.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!item?.id || !uploads) return null;
  return { channelId: item.id, uploadsPlaylistId: uploads };
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
  nextPageToken?: string;
}

/**
 * Lists up to `limit` of the channel's most-recent upload video ids via the
 * uploads playlist (playlistItems.list, 1 unit/page of 50, NEWEST first). One
 * page covers the default 30-video sample, so this is typically a single unit.
 */
export async function listRecentUploadIds(
  uploadsPlaylistId: string,
  key: string,
  limit: number = RECENT_UPLOADS_SAMPLE
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < limit) {
    const remaining = limit - ids.length;
    const data: PlaylistItemsResponse = await apiGet<PlaylistItemsResponse>(
      "playlistItems",
      {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(Math.min(50, remaining)),
        ...(pageToken ? { pageToken } : {}),
      },
      key
    );
    for (const it of data.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids.slice(0, limit);
}

interface VideosListResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: { viewCount?: string };
  }>;
}

/** Splits an array into chunks of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetches view counts + titles + publishedAt for the given video ids via
 * videos.list, batched 50/call (1 unit/batch). Videos without a numeric
 * viewCount (e.g. private/hidden stats) are skipped.
 */
export async function fetchVideoStats(
  videoIds: string[],
  key: string
): Promise<VideoStat[]> {
  const stats: VideoStat[] = [];
  for (const batch of chunk(videoIds, 50)) {
    if (batch.length === 0) continue;
    const data = await apiGet<VideosListResponse>(
      "videos",
      { part: "snippet,statistics", id: batch.join(",") },
      key
    );
    for (const it of data.items ?? []) {
      const views = Number(it.statistics?.viewCount);
      if (!Number.isFinite(views)) continue;
      stats.push({
        videoId: it.id,
        title: it.snippet?.title ?? "(untitled)",
        views,
        publishedAt: it.snippet?.publishedAt ?? new Date(0).toISOString(),
      });
    }
  }
  return stats;
}

/**
 * Full per-channel pipeline: resolve the handle, list its recent uploads, fetch
 * their stats, then compute the median + return that channel's outliers. A
 * handle that can't be resolved (typo / deleted channel) yields [] rather than
 * throwing, so one bad handle doesn't abort the whole scan.
 */
export async function findOutliers(
  channelHandle: string,
  key: string,
  options: { threshold?: number; now?: number; sample?: number } = {}
): Promise<Outlier[]> {
  const resolved = await resolveChannel(channelHandle, key);
  if (!resolved) {
    console.log(`[competitors] could not resolve handle ${channelHandle}; skipping.`);
    return [];
  }
  const ids = await listRecentUploadIds(
    resolved.uploadsPlaylistId,
    key,
    options.sample ?? RECENT_UPLOADS_SAMPLE
  );
  if (ids.length === 0) return [];
  const stats = await fetchVideoStats(ids, key);
  return detectOutliers(channelHandle, stats, {
    threshold: options.threshold,
    now: options.now,
  });
}

/** Result of a full scan: the ranked outliers plus per-channel error notes. */
export interface ScanResult {
  outliers: Outlier[];
  /** Handles that failed to scan (with a short reason), for UI surfacing. */
  errors: Array<{ handle: string; message: string }>;
}

/**
 * Scans every handle, aggregates the outliers, and ranks + caps them (top
 * MAX_OUTLIERS by the age-aware score). A per-channel failure is recorded in
 * `errors` and the scan continues — a single bad/handle quota hit shouldn't lose
 * the rest. (A keyInvalid/quotaExceeded error usually fails ALL channels; the
 * route still returns whatever succeeded plus the error notes.)
 */
export async function scanAll(
  handles: string[],
  key: string,
  options: { threshold?: number; now?: number; max?: number; sample?: number } = {}
): Promise<ScanResult> {
  if (!key) {
    throw new MissingEnvError(
      "YOUTUBE_DATA_API_KEY is not set. Add your YouTube Data API key in Settings."
    );
  }
  const all: Outlier[] = [];
  const errors: Array<{ handle: string; message: string }> = [];

  for (const handle of handles) {
    try {
      const found = await findOutliers(handle, key, {
        threshold: options.threshold,
        now: options.now,
        sample: options.sample,
      });
      all.push(...found);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while scanning.";
      console.log(`[competitors] scan failed for ${handle}: ${message}`);
      errors.push({ handle, message });
    }
  }

  return { outliers: rankAndCap(all, options.max ?? MAX_OUTLIERS), errors };
}
