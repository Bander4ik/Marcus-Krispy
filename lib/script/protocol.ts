/**
 * Streaming protocol shared by the API route and the Script UI.
 *
 * The route streams a `text/plain` body of newline-delimited JSON ("NDJSON"):
 * one JSON object per line. The client splits on "\n" and parses each line.
 * This lets the multi-step engine interleave STAGE markers (research → draft)
 * with the streamed script TOKENS over a single response body.
 *
 * Each event is one of:
 *   { type: "stage", stage, status: "start" }
 *   { type: "stage", stage: "research", status: "done", outline, sources }
 *   { type: "token", text }            // script text delta (Stage 2)
 *   { type: "done" }
 *   { type: "error", message }
 */
import type { SourceLink } from "@/lib/script/types";

/**
 * Pipeline stages:
 *   research / draft → the Step 1→2 script pipeline (lib/script/pipeline.ts)
 *   audit            → the Step 3 fact-audit phases (lib/script/fact-audit.ts);
 *                      the same `token` events stream the phase's markdown body.
 */
export type Stage = "research" | "draft" | "audit";

export type ScriptEvent =
  | { type: "stage"; stage: Stage; status: "start" }
  | {
      type: "stage";
      stage: "research";
      status: "done";
      outline: string;
      sources: SourceLink[];
    }
  | { type: "stage"; stage: "draft"; status: "start" }
  | { type: "stage"; stage: "audit"; status: "start" }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Serializes one event as a single NDJSON line (trailing newline included). */
export function encodeEvent(event: ScriptEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Stateful line splitter for the client: feed it raw decoded chunks, get back
 * fully-parsed events. Buffers any partial trailing line across chunks.
 */
export function createEventParser(): (chunk: string) => ScriptEvent[] {
  let buffer = "";
  return (chunk: string): ScriptEvent[] => {
    buffer += chunk;
    const lines = buffer.split("\n");
    // Keep the last (possibly partial) segment in the buffer.
    buffer = lines.pop() ?? "";
    const events: ScriptEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as ScriptEvent);
      } catch {
        // Ignore malformed lines rather than breaking the stream.
      }
    }
    return events;
  };
}
