/**
 * SEAM — Tab 2: Competitors / Outliers (PHASE-2 PLACEHOLDER, NOT implemented).
 *
 * Mirrors the `yt-channel-ai/src/lib/youtube.ts` pattern: public YouTube Data
 * API v3 via raw `fetch` against https://www.googleapis.com/youtube/v3, key-based,
 * no OAuth, no user data.
 *
 * Will read YOUTUBE_DATA_API_KEY from env (Phase-1 keeps it in env; in-app key
 * entry like yt-channel-ai's integrations page is a Tab-2 decision).
 *
 * Interface: discover and inspect competitor channels/videos so Marcus can find
 * niche outliers (the building block from yt-channel-ai's nicheExplorer).
 */

const NOT_IMPLEMENTED = "lib/youtube/data-api: not implemented — Phase 2 seam";

export interface VideoSummary {
  id: string;
  title: string;
  channelId: string;
  views?: number;
}

export interface ChannelSummary {
  id: string;
  title: string;
  subscribers?: number;
}

/** Search public videos by query. */
export function searchVideos(_query: string): Promise<VideoSummary[]> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Fetch a single channel's public metadata. */
export function getChannel(_channelId: string): Promise<ChannelSummary> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Fetch public metadata for a list of video ids. */
export function getVideos(_ids: string[]): Promise<VideoSummary[]> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Outlier discovery from a seed (channel or topic). */
export function nicheExplorer(_seed: string): Promise<VideoSummary[]> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Fetch trending videos for the niche. */
export function fetchTrending(): Promise<VideoSummary[]> {
  throw new Error(NOT_IMPLEMENTED);
}
