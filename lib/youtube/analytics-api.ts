/**
 * SEAM — Tab 3: YouTube Analytics API (PHASE-3 PLACEHOLDER, NOT implemented).
 *
 * Mirrors the `yt-channel-ai/src/lib/yt-analytics.ts` pattern: raw `fetch` to
 * https://youtubeanalytics.googleapis.com/v2/reports with
 * `Authorization: Bearer <token>` (token from lib/youtube/oauth.ts).
 *
 * Private, owner-only data — queries use `ids=channel==UC...`. Revenue requires
 * the monetary scope (yt-analytics-monetary.readonly).
 */

const NOT_IMPLEMENTED =
  "lib/youtube/analytics-api: not implemented — Phase 3 seam";

export interface OverviewReport {
  views: number;
  watchTimeMinutes: number;
  subscribersGained: number;
}

/** Channel-level overview (views, watch time, subs). */
export function fetchOverview(): Promise<OverviewReport> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Audience-retention curve for a single video. */
export function fetchRetention(_videoId: string): Promise<unknown> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Traffic-source breakdown. */
export function fetchTrafficSources(): Promise<unknown> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Revenue report (monetary scope, owner-only). */
export function fetchRevenue(): Promise<unknown> {
  throw new Error(NOT_IMPLEMENTED);
}
