/**
 * MODEL ROUTER — maps a task kind to a provider + model, with env-var override
 * so the model is swappable WITHOUT code changes.
 *
 *   SCRIPT_MODEL      → overrides the strong/script model id (provider stays Anthropic)
 *   MECHANICAL_MODEL  → overrides the cheap/mechanical model id (provider stays Gemini)
 *
 * The router only PICKS models and constructs clients. Provider-specific call
 * logic lives in anthropic.ts / gemini.ts (never mix providers in one file).
 */
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import {
  getScriptModel,
  getMechanicalModel,
  resolveAnthropicKey,
} from "@/lib/env";

// Task taxonomy — extend as Phase-2 adds mechanical steps.
export type ModelTask =
  | "script-writing" // STRONG model — quality-critical
  | "mechanical"; // CHEAP model — outlines, tags, cleanup, classification

export type Provider = "anthropic" | "gemini";

export interface ModelChoice {
  provider: Provider;
  model: string;
}

// Defaults per task. Overridable by env so the model swaps without a deploy.
const DEFAULTS: Record<ModelTask, ModelChoice> = {
  "script-writing": { provider: "anthropic", model: "claude-sonnet-4-6" },
  mechanical: { provider: "gemini", model: "gemini-2.5-flash" },
};

export function pickModel(task: ModelTask): ModelChoice {
  const d = DEFAULTS[task];
  if (task === "script-writing") {
    const override = getScriptModel();
    if (override) return { ...d, model: override }; // still Anthropic provider
  }
  if (task === "mechanical") {
    const override = getMechanicalModel();
    if (override) return { ...d, model: override }; // still Gemini provider
  }
  return d;
}

// Lazily-constructed singletons (created only when first used, after env loads).
let _anthropic: Anthropic | null = null;
/** The key the cached client was built with — lets us rebuild if it changes. */
let _anthropicKey: string | undefined;

/**
 * The Anthropic client.
 *
 * The key is env-first with a saved-file fallback (see resolveAnthropicKey).
 * Because the saved key lives in a file, it's resolved asynchronously by
 * `ensureAnthropicClient()` and cached on the singleton. `anthropicClient()`
 * stays synchronous for the streaming call sites (streamAnthropic /
 * converseAnthropic), returning the primed singleton — or, if nothing primed it
 * yet, a default client that reads ANTHROPIC_API_KEY from the environment.
 *
 * The route handlers call `ensureAnthropicClient()` (after assertScriptRunnable)
 * so the saved-file key is applied before any model call.
 */
export function anthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic(); // env-only fallback
  return _anthropic;
}

/**
 * Resolves the Anthropic key (env-first, saved-file fallback) and builds the
 * client singleton with it. If the resolved key has changed since the cached
 * client was built (e.g. the user just saved a key in Settings while the dev
 * server is running), the client is rebuilt — so a newly-saved key takes effect
 * without a restart. Call this at the request boundary before any Anthropic
 * call.
 */
export async function ensureAnthropicClient(): Promise<Anthropic> {
  const apiKey = await resolveAnthropicKey();
  if (!_anthropic || _anthropicKey !== apiKey) {
    // If apiKey is undefined the SDK falls back to env; callers gate on
    // assertScriptRunnable() first, so we won't reach a real call without a key.
    _anthropic = new Anthropic(apiKey ? { apiKey } : {});
    _anthropicKey = apiKey;
  }
  return _anthropic;
}

let _gemini: GoogleGenAI | null = null;
export function geminiClient(): GoogleGenAI {
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  return _gemini;
}
