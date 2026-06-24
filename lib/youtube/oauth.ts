/**
 * SEAM — Tab 3: Google OAuth 2.0 "bring your own client" (PHASE-3 PLACEHOLDER,
 * NOT implemented).
 *
 * Mirrors the `yt-channel-ai/src/lib/google-oauth.ts` pattern: hand-rolled
 * OAuth 2.0 via raw `fetch` (no googleapis SDK).
 *
 * Will need: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
 * PUBLIC_BASE_URL (for the redirect origin). Fixed redirect path:
 *   `${PUBLIC_BASE_URL}/api/youtube/oauth/callback`
 *
 * Scopes (documented here for Tab-3 build): yt-analytics.readonly,
 * yt-analytics-monetary.readonly, youtube.readonly.
 *
 * Token storage is a DELIBERATELY-DEFERRED decision: env now; SQLite /
 * getSetting / setSetting (like yt-channel-ai) when this tab is built.
 */

const NOT_IMPLEMENTED = "lib/youtube/oauth: not implemented — Phase 3 seam";

export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

export const OAUTH_REDIRECT_PATH = "/api/youtube/oauth/callback";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Build the Google consent-screen URL. */
export function buildAuthUrl(_state: string): string {
  throw new Error(NOT_IMPLEMENTED);
}

/** Exchange an authorization code for tokens. */
export function exchangeCode(_code: string): Promise<OAuthTokens> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Refresh an expired access token. */
export function refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Return a valid (refreshed if needed) access token. */
export function getValidAccessToken(): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}
