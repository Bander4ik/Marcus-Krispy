/**
 * Engine selector — the seam that lets the engine swap WITHOUT touching the
 * route or the UI.
 *
 * SCRIPT_ENGINE = "pipeline" (default) → MultiStepEngine (title→outline→draft,
 *                                        web search; the real process)
 *               = "single-shot"        → SingleShotEngine (placeholder fallback)
 */
import { getScriptEngineName } from "@/lib/env";
import { SingleShotEngine } from "@/lib/script/single-shot";
import { MultiStepEngine } from "@/lib/script/pipeline";
import type { ScriptEngine } from "@/lib/script/types";

export function getScriptEngine(): ScriptEngine {
  const name = getScriptEngineName();
  switch (name) {
    case "single-shot":
      return new SingleShotEngine();
    case "pipeline":
    default:
      return new MultiStepEngine();
  }
}
