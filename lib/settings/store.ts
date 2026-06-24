/**
 * Server-side secrets store — lets a non-technical user save their Anthropic
 * key from the web UI instead of editing .env.local.
 *
 * The key is written to a JSON file OUTSIDE the repo at ~/.marcus-krispy/
 * secrets.json (mode 0600). This app runs LOCALLY for a single user, so a
 * home-dir file with owner-only permissions is acceptable — see the SECURITY
 * note in STATUS.md (any public deploy must gate this behind APP_PASSWORD).
 *
 * The store is deliberately tiny and robust: a missing or corrupt file is
 * treated as empty (never throws on read). The key is NEVER logged.
 *
 * Testability: the home dir is resolved from MARCUS_KRISPY_HOME if set, else
 * os.homedir(). Tests point MARCUS_KRISPY_HOME at a temp dir so the suite never
 * touches the real home directory.
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";

/** Shape of the on-disk secrets file. All fields optional. */
interface SecretsFile {
  anthropicKey?: string;
  /** Optional saved override of the strong script model id (provider stays Anthropic). */
  scriptModel?: string;
}

/** Directory name created under the home dir. */
const APP_DIR = ".marcus-krispy";
const SECRETS_FILE = "secrets.json";

/** Resolves the home dir, allowing an override for testability. */
function homeDir(): string {
  return process.env.MARCUS_KRISPY_HOME?.trim() || os.homedir();
}

function appDir(): string {
  return path.join(homeDir(), APP_DIR);
}

function secretsPath(): string {
  return path.join(appDir(), SECRETS_FILE);
}

/** Reads + parses the secrets file. Missing/corrupt → empty object. */
async function readSecrets(): Promise<SecretsFile> {
  let raw: string;
  try {
    raw = await fs.readFile(secretsPath(), "utf-8");
  } catch {
    return {}; // missing file
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SecretsFile;
    return {};
  } catch {
    return {}; // corrupt JSON
  }
}

/**
 * Writes the secrets file with mode 0600, creating ~/.marcus-krispy/ if needed.
 * `mode` on writeFile only applies when the file is CREATED, so we also chmod
 * after writing to enforce 0600 on an existing file.
 */
async function writeSecrets(secrets: SecretsFile): Promise<void> {
  const dir = appDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = secretsPath();
  await fs.writeFile(file, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  // Enforce owner-only perms even if the file already existed with looser ones.
  try {
    await fs.chmod(file, 0o600);
  } catch {
    // Best-effort (e.g. some filesystems reject chmod); the write succeeded.
  }
}

/** Returns the saved Anthropic key, or undefined if none/blank/corrupt. */
export async function getSavedAnthropicKey(): Promise<string | undefined> {
  const secrets = await readSecrets();
  const key = secrets.anthropicKey?.trim();
  return key || undefined;
}

/** Saves (trims) the Anthropic key, preserving any other saved settings. */
export async function saveAnthropicKey(key: string): Promise<void> {
  const secrets = await readSecrets();
  secrets.anthropicKey = key.trim();
  await writeSecrets(secrets);
}

/** Clears the saved Anthropic key, preserving any other saved settings. */
export async function clearAnthropicKey(): Promise<void> {
  const secrets = await readSecrets();
  delete secrets.anthropicKey;
  await writeSecrets(secrets);
}

/** Returns the saved SCRIPT_MODEL override, or undefined if none/blank. */
export async function getSavedScriptModel(): Promise<string | undefined> {
  const secrets = await readSecrets();
  const model = secrets.scriptModel?.trim();
  return model || undefined;
}
