/**
 * GET/POST/DELETE /api/settings — manage the Anthropic API key from the web UI
 * (so a non-technical user doesn't have to edit .env.local).
 *
 *   GET    → MASKED status only: { set, source, last4, envPresent, model? }.
 *            NEVER returns the full key.
 *   POST   → { anthropicKey }: trims, validates the format (sk-ant-…), saves to
 *            ~/.marcus-krispy/secrets.json via the store, returns the status.
 *            400 JSON on an invalid format.
 *   DELETE → clears the SAVED key (never touches the environment), returns
 *            the status.
 *
 * Precedence (see resolveAnthropicKey): the environment var wins if set; the
 * saved-file key is the fallback. The status reports which source is active and
 * whether an env key is also present.
 *
 * SECURITY: local single-user use only. The key is never logged and never
 * returned un-masked. Any public deployment MUST gate this behind APP_PASSWORD.
 */
import { getAnthropicKey, getScriptModel } from "@/lib/env";
import {
  getSavedAnthropicKey,
  saveAnthropicKey,
  clearAnthropicKey,
  getSavedScriptModel,
} from "@/lib/settings/store";

export const runtime = "nodejs";

interface KeyStatus {
  set: boolean;
  source: "env" | "file" | null;
  last4: string | null;
  envPresent: boolean;
  model?: string;
}

/** Last 4 chars of a key, for a "sk-…1234" masked display. Null if too short. */
function last4Of(key: string): string | null {
  return key.length >= 4 ? key.slice(-4) : null;
}

/**
 * Builds the masked status with env-first precedence. Reads the env key and the
 * saved-file key; the env key wins when both exist. Never includes the full key.
 */
async function buildStatus(): Promise<KeyStatus> {
  const envKey = getAnthropicKey();
  const fileKey = await getSavedAnthropicKey();
  const envPresent = Boolean(envKey);

  // The model shown is the override that would actually apply (env-first too).
  const model = getScriptModel() ?? (await getSavedScriptModel());

  if (envKey) {
    return {
      set: true,
      source: "env",
      last4: last4Of(envKey),
      envPresent,
      ...(model ? { model } : {}),
    };
  }
  if (fileKey) {
    return {
      set: true,
      source: "file",
      last4: last4Of(fileKey),
      envPresent,
      ...(model ? { model } : {}),
    };
  }
  return {
    set: false,
    source: null,
    last4: null,
    envPresent,
    ...(model ? { model } : {}),
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
}

export async function POST(request: Request): Promise<Response> {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = typeof body.anthropicKey === "string" ? body.anthropicKey.trim() : "";
  if (!raw) {
    return Response.json(
      { error: "An Anthropic API key is required." },
      { status: 400 }
    );
  }
  if (!looksLikeAnthropicKey(raw)) {
    return Response.json(
      {
        error:
          "That doesn't look like an Anthropic API key. It should start with “sk-ant-”.",
      },
      { status: 400 }
    );
  }

  await saveAnthropicKey(raw);
  return Response.json(await buildStatus());
}

export async function DELETE(): Promise<Response> {
  await clearAnthropicKey();
  return Response.json(await buildStatus());
}
