/**
 * Gemini 2.5 Flash wrapper — cheap, mechanical steps.
 *
 * UNUSED in Phase-1. Present so future mechanical steps (title cleanup, outline
 * extraction, tag generation, classification) have a home without retrofitting.
 * Guarded by GEMINI_API_KEY — throws a clear error if called without a key.
 */
import { geminiClient } from "@/lib/models/router";
import { pickModel } from "@/lib/models/router";
import { getGeminiKey } from "@/lib/env";

export interface RunGeminiParams {
  prompt: string;
  model?: string;
}

/**
 * Runs a single-prompt generation against Gemini 2.5 Flash (or an override
 * via MECHANICAL_MODEL). Returns the plain-text response.
 */
export async function runGemini(params: RunGeminiParams): Promise<string> {
  if (!getGeminiKey()) {
    throw new Error(
      "GEMINI_API_KEY is not set — the mechanical (Gemini) path is unavailable."
    );
  }
  const model = params.model ?? pickModel("mechanical").model;
  const client = geminiClient();

  const response = await client.models.generateContent({
    model,
    contents: params.prompt,
  });

  return response.text ?? "";
}
