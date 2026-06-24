/**
 * Channel loader — reads channels/<id>/channel.json plus the prompt files it
 * points to, and returns a Channel object. Mirrors Scriptwriter Dave's
 * channel-config-as-data pattern (channel.json + system_prompt.md +
 * voice_fingerprint.md per channel).
 */
import { promises as fs } from "fs";
import path from "path";
import type { Channel, ChannelPrompts } from "@/lib/script/types";

/**
 * Channel files (channel.json + prompts/*.md) are read from the project root at
 * REQUEST time. We anchor on `process.cwd()` because that's the project root for
 * the intended deployment: `npm run build && npm run start` run from this dir.
 *
 * Serverless / bundled caveat: on platforms that bundle the route into an
 * isolated function (and don't include the `channels/` dir in the file trace),
 * `process.cwd()` may not point at a dir that contains `channels/`, and these
 * reads will fail. The Turbopack build prints one NFT warning about the
 * fs/path use here for exactly this reason. For local use this is correct; for
 * a serverless deploy, ship `channels/` as a traced asset (e.g.
 * `outputFileTracingIncludes`) or move the prompt text into the bundle. The
 * loader surfaces a missing dir as a clear "prompts not found" rather than a
 * cryptic crash — see loadPrompts below.
 */
const CHANNELS_DIR = path.join(process.cwd(), "channels");

/** Relative paths (from the channel dir) to the staged pipeline prompts. */
const PROMPT_FILES = {
  step1Research: "prompts/step1_research.md",
  step2Script: "prompts/step2_script.md",
  factAudit: "prompts/fact_audit.md",
} as const;

interface ChannelJson {
  id: string;
  name: string;
  description?: string;
  task?: string;
  systemPrompt: string; // filename, e.g. "system_prompt.md"
  voiceFingerprint: string; // filename, e.g. "voice_fingerprint.md"
  finalLabel?: string;
  placeholder?: boolean;
}

/**
 * Loads the staged pipeline prompts (step1 / step2 / fact_audit) from the
 * channel's prompts/ dir. Returns undefined if any is missing, so the
 * single-shot fallback engine still works on a channel without them.
 * Prompt text is NEVER hardcoded in TS — it is read from these files.
 */
async function loadPrompts(dir: string): Promise<ChannelPrompts | undefined> {
  try {
    const [step1Research, step2Script, factAudit] = await Promise.all([
      fs.readFile(path.join(dir, PROMPT_FILES.step1Research), "utf-8"),
      fs.readFile(path.join(dir, PROMPT_FILES.step2Script), "utf-8"),
      fs.readFile(path.join(dir, PROMPT_FILES.factAudit), "utf-8"),
    ]);
    return { step1Research, step2Script, factAudit };
  } catch {
    return undefined;
  }
}

async function readChannelJson(id: string): Promise<ChannelJson> {
  const file = path.join(CHANNELS_DIR, id, "channel.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as ChannelJson;
}

/** Loads a single channel by id, reading its prompt files. */
export async function loadChannel(id: string): Promise<Channel> {
  const meta = await readChannelJson(id);
  const dir = path.join(CHANNELS_DIR, id);

  const [systemPrompt, voiceFingerprint, prompts] = await Promise.all([
    fs.readFile(path.join(dir, meta.systemPrompt), "utf-8"),
    fs.readFile(path.join(dir, meta.voiceFingerprint), "utf-8"),
    loadPrompts(dir),
  ]);

  return {
    id: meta.id,
    name: meta.name,
    task: meta.task ?? "script-writing",
    systemPrompt,
    voiceFingerprint,
    prompts,
    finalLabel: meta.finalLabel ?? "Script.md",
    placeholder: meta.placeholder ?? false,
  };
}

/** Scans the channels/ directory and returns lightweight channel summaries. */
export async function listChannels(): Promise<
  Array<{ id: string; name: string; placeholder: boolean }>
> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(CHANNELS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries.filter((e) => e.isDirectory());
  const out: Array<{ id: string; name: string; placeholder: boolean }> = [];
  for (const d of dirs) {
    try {
      const meta = await readChannelJson(d.name);
      out.push({
        id: meta.id,
        name: meta.name,
        placeholder: meta.placeholder ?? false,
      });
    } catch {
      // Skip directories without a valid channel.json.
    }
  }
  return out;
}
