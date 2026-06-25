/**
 * GET/POST/DELETE /api/settings — manage the API keys from the web UI
 * (so a non-technical user doesn't have to edit .env.local).
 *
 *   GET    → MASKED status only: { set, source, last4, envPresent, model?,
 *            youtube }. NEVER returns a full key.
 *   POST   → { anthropicKey?, youtubeDataApiKey? }: trims + validates whichever
 *            key(s) are present, saves to ~/.marcus-krispy/secrets.json via the
 *            store, returns the status. 400 JSON on an invalid format / when no
 *            recognized key is provided. (The Anthropic key requires the
 *            sk-ant- format; the YouTube key is validated only as non-empty.)
 *   DELETE → ?key=youtube clears the saved YouTube key; otherwise clears the
 *            saved Anthropic key. Never touches the environment. Returns status.
 *
 * Precedence (see resolveAnthropicKey): the environment var wins if set; the
 * saved-file key is the fallback. The status reports which source is active and
 * whether an env key is also present.
 *
 * SECURITY: local single-user use only. The key is never logged and never
 * returned un-masked. Any public deployment MUST gate this behind APP_PASSWORD.
 */
import { getAnthropicKey, getScriptModel, getYouTubeKey } from "@/lib/env";
import {
  getSavedAnthropicKey,
  saveAnthropicKey,
  clearAnthropicKey,
  getSavedScriptModel,
  getSavedYouTubeKey,
  saveYouTubeKey,
  clearYouTubeKey,
} from "@/lib/settings/store";

export const runtime = "nodejs";

/** Masked status for a single key (no full value, only last4 + source). */
interface SingleKeyStatus {
  set: boolean;
  source: "env" | "file" | null;
  last4: string | null;
  envPresent: boolean;
}

interface KeyStatus extends SingleKeyStatus {
  model?: string;
  /** Masked status of the YouTube Data API key (Competitors tab). */
  youtube: SingleKeyStatus;
}

/** Last 4 chars of a key, for a "sk-…1234" masked display. Null if too short. */
function last4Of(key: string): string | null {
  return key.length >= 4 ? key.slice(-4) : null;
}

/**
 * Masked, env-first status for one key: env wins when both exist; otherwise the
 * saved-file key; otherwise not-set. NEVER includes the full key value.
 */
function singleStatus(
  envKey: string | undefined,
  fileKey: string | undefined
): SingleKeyStatus {
  const envPresent = Boolean(envKey);
  if (envKey) {
    return { set: true, source: "env", last4: last4Of(envKey), envPresent };
  }
  if (fileKey) {
    return { set: true, source: "file", last4: last4Of(fileKey), envPresent };
  }
  return { set: false, source: null, last4: null, envPresent };
}

/**
 * Builds the masked status with env-first precedence for BOTH keys (Anthropic +
 * YouTube). Reads each env key and its saved-file fallback; the env key wins
 * when both exist. Never includes a full key value.
 */
async function buildStatus(): Promise<KeyStatus> {
  const anthropic = singleStatus(
    getAnthropicKey(),
    await getSavedAnthropicKey()
  );
  const youtube = singleStatus(getYouTubeKey(), await getSavedYouTubeKey());

  // The model shown is the override that would actually apply (env-first too).
  const model = getScriptModel() ?? (await getSavedScriptModel());

  return {
    ...anthropic,
    ...(model ? { model } : {}),
    youtube,
  };
}

/** True if the value looks like an Anthropic key (sk-ant-… , reasonable length). */
function looksLikeAnthropicKey(key: string): boolean {
  return key.startsWith("sk-ant-") && key.length >= 20 && key.length <= 300;
}

export async function GET(): Promise<Response> {
  return Response.json(await buildStatus());
}

interface PostBody {
  anthropicKey?: unknown;
  youtubeDataApiKey?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const anthropicRaw =
    typeof body.anthropicKey === "string" ? body.anthropicKey.trim() : "";
  const youtubeRaw =
    typeof body.youtubeDataApiKey === "string"
      ? body.youtubeDataApiKey.trim()
      : "";

  // At least one recognized key must be present (and non-empty).
  const hasAnthropicField = "anthropicKey" in body;
  const hasYouTubeField = "youtubeDataApiKey" in body;
  if (!hasAnthropicField && !hasYouTubeField) {
    return Response.json(
      { error: "An Anthropic API key is required." },
      { status: 400 }
    );
  }

  // Validate the Anthropic key (sk-ant- format) when provided.
  if (hasAnthropicField) {
    if (!anthropicRaw) {
      return Response.json(
        { error: "An Anthropic API key is required." },
        { status: 400 }
      );
    }
    if (!looksLikeAnthropicKey(anthropicRaw)) {
      return Response.json(
        {
          error:
            "That doesn't look like an Anthropic API key. It should start with “sk-ant-”.",
        },
        { status: 400 }
      );
    }
  }

  // Validate the YouTube key (non-empty only — Google keys have no fixed prefix).
  if (hasYouTubeField && !youtubeRaw) {
    return Response.json(
      { error: "A YouTube Data API key is required." },
      { status: 400 }
    );
  }

  if (hasAnthropicField) await saveAnthropicKey(anthropicRaw);
  if (hasYouTubeField) await saveYouTubeKey(youtubeRaw);
  return Response.json(await buildStatus());
}

/**
 * DELETE clears a SAVED key (never the environment). `?key=youtube` clears the
 * YouTube key; anything else (or no param) clears the Anthropic key, preserving
 * the original single-key behavior.
 */
export async function DELETE(request: Request): Promise<Response> {
  const which = new URL(request.url).searchParams.get("key");
  if (which === "youtube") {
    await clearYouTubeKey();
  } else {
    await clearAnthropicKey();
  }
  return Response.json(await buildStatus());
}
