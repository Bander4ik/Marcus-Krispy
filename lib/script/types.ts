/**
 * Shared types for the script-generation layer.
 */

/** A channel's loaded config + prompt files. */
export interface Channel {
  id: string;
  name: string;
  /** Task tier for the model router (e.g. "script-writing"). */
  task: string;
  /** The full system prompt text (channel persona). */
  systemPrompt: string;
  /** The voice fingerprint / style bank text, injected as a labeled section. */
  voiceFingerprint: string;
  /**
   * The multi-step pipeline prompts, loaded from channels/<id>/prompts/.
   * Present when the channel ships the staged prompts; the MultiStepEngine
   * requires them. Prompt text is NEVER hardcoded in TS — it lives in the
   * channel files and is loaded at request time.
   */
  prompts?: ChannelPrompts;
  /** Output label (e.g. "Script.md"). */
  finalLabel: string;
  /** True when the channel is using placeholder prompts (real prompt pending). */
  placeholder: boolean;
}

/** The staged prompt files for the title → outline → draft (→ audit) pipeline. */
export interface ChannelPrompts {
  /** Step 1 — research + structure (web search). Used as the system prompt. */
  step1Research: string;
  /** Step 2 — write the continuous script from the blueprint. System prompt. */
  step2Script: string;
  /** Step 3 — fact audit. Loaded for the (not-yet-built) audit seam. */
  factAudit: string;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface ScriptRequest {
  /** The video title or idea the user typed. */
  title: string;
  /** The resolved channel. */
  channel: Channel;
}

/** Result of Stage 1 (research + structure). */
export interface OutlineResult {
  /** The source-grounded bullet blueprint text. */
  outline: string;
  /** Source URLs surfaced by the web-search tool, deduped, in first-seen order. */
  sources: SourceLink[];
  model: string;
  usage?: TokenUsage;
}

/** A single web-search source surfaced during research. */
export interface SourceLink {
  url: string;
  title?: string;
}

export interface ScriptResult {
  script: string;
  model: string;
  usage?: TokenUsage;
  /** Present for the multi-step engine: the Stage-1 blueprint + its sources. */
  outline?: string;
  sources?: SourceLink[];
}

export interface ScriptEngine {
  /** Streaming generation — used by the API route. Returns a streamed Response. */
  streamRun(req: ScriptRequest): Response;
  /** Non-streaming generation — for tests / batch use. */
  run(req: ScriptRequest): Promise<ScriptResult>;
}
