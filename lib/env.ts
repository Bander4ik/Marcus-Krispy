/**
 * Typed env access — single source of truth for secrets and runtime settings.
 * Keep all `process.env.*` reads here so route handlers and engines stay clean.
 * NEVER hardcode keys.
 *
 * Keys are env-first: the environment (.env.local) always wins. A non-technical
 * user who can't edit .env.local may instead save the Anthropic key from the
 * Settings tab, which writes it to ~/.marcus-krispy/secrets.json (see
 * lib/settings/store.ts). `resolveAnthropicKey()` applies that precedence.
 */
import { getSavedAnthropicKey } from "@/lib/settings/store";

/** Thrown when a required secret/config is missing for a feature. */
export class MissingEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

/** The Anthropic key from the ENVIRONMENT only (no saved-file fallback). */
export function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

/**
 * Resolves the Anthropic key with env-first precedence: the environment var
 * wins if set (non-empty); otherwise the key saved from the Settings tab. If
 * BOTH exist, env wins (and the Settings UI notes this). Returns undefined when
 * neither is present.
 */
export async function resolveAnthropicKey(): Promise<string | undefined> {
  return getAnthropicKey() ?? (await getSavedAnthropicKey());
}

export function getGeminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

/** Optional override of the strong script model id (provider stays Anthropic). */
export function getScriptModel(): string | undefined {
  return process.env.SCRIPT_MODEL?.trim() || undefined;
}

/** Optional override of the cheap mechanical model id (provider stays Gemini). */
export function getMechanicalModel(): string | undefined {
  return process.env.MECHANICAL_MODEL?.trim() || undefined;
}

/** "pipeline" (default — title→outline→draft) | "single-shot" (fallback). */
export function getScriptEngineName(): string {
  return process.env.SCRIPT_ENGINE?.trim() || "pipeline";
}

/** Optional login gate. Empty locally = no login; REQUIRED on any deploy. */
export function getAppPassword(): string | undefined {
  return process.env.APP_PASSWORD?.trim() || undefined;
}

/**
 * Throws a typed error if the live Script feature can't run.
 * Phase-1 only needs the Anthropic key (env OR saved via the Settings tab).
 */
export async function assertScriptRunnable(): Promise<void> {
  if (!(await resolveAnthropicKey())) {
    throw new MissingEnvError(
      "ANTHROPIC_API_KEY is not set. Add your key in Settings, or copy .env.local.example to .env.local and set it there."
    );
  }
}
