"use client";

import { useEffect, useState } from "react";

const PANEL: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--panel)",
  borderRadius: 10,
  padding: 16,
};

const PRIMARY_BTN: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#1a1408",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const SECONDARY_BTN: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: 14,
  cursor: "pointer",
};

const INPUT: React.CSSProperties = {
  flex: "1 1 280px",
  background: "var(--background)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 10,
  fontSize: 14,
  fontFamily: "inherit",
};

/** Masked status for one key (Anthropic or YouTube). */
interface SingleKeyStatus {
  set: boolean;
  source: "env" | "file" | null;
  last4: string | null;
  envPresent: boolean;
}

/** The /api/settings status: Anthropic key fields + a nested `youtube` status. */
interface SettingsStatus extends SingleKeyStatus {
  model?: string;
  youtube: SingleKeyStatus;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);

  // Anthropic key form state.
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // YouTube key form state.
  const [ytInput, setYtInput] = useState("");
  const [ytBusy, setYtBusy] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytSaved, setYtSaved] = useState(false);

  // Load the current (masked) status on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const data = (await res.json()) as SettingsStatus;
        if (active) setStatus(data);
      } catch {
        if (active) setError("Couldn't load settings.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    const key = keyInput.trim();
    if (!key || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey: key }),
      });
      const data = (await res.json()) as SettingsStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setStatus(data);
      setKeyInput("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the key.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = (await res.json()) as SettingsStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the key.");
    } finally {
      setBusy(false);
    }
  }

  async function saveYouTube() {
    const key = ytInput.trim();
    if (!key || ytBusy) return;
    setYtBusy(true);
    setYtError(null);
    setYtSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeDataApiKey: key }),
      });
      const data = (await res.json()) as SettingsStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setStatus(data);
      setYtInput("");
      setYtSaved(true);
      setTimeout(() => setYtSaved(false), 2000);
    } catch (e) {
      setYtError(e instanceof Error ? e.message : "Couldn't save the key.");
    } finally {
      setYtBusy(false);
    }
  }

  async function clearYouTube() {
    if (ytBusy) return;
    setYtBusy(true);
    setYtError(null);
    setYtSaved(false);
    try {
      const res = await fetch("/api/settings?key=youtube", { method: "DELETE" });
      const data = (await res.json()) as SettingsStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setStatus(data);
    } catch (e) {
      setYtError(e instanceof Error ? e.message : "Couldn't clear the key.");
    } finally {
      setYtBusy(false);
    }
  }

  const yt = status?.youtube ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Settings</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Connect your API keys here — no file editing needed.
        </p>
      </div>

      {/* ---------------------- Anthropic key ---------------------- */}
      <div style={PANEL}>
        <label
          htmlFor="anthropic-key"
          style={{
            display: "block",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Anthropic API key (for the Script tab)
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            id="anthropic-key"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            style={INPUT}
          />
          <button
            onClick={save}
            disabled={busy || !keyInput.trim()}
            style={{
              ...PRIMARY_BTN,
              background: busy || !keyInput.trim() ? "#3a3f47" : "var(--accent)",
              color: busy || !keyInput.trim() ? "var(--muted)" : "#1a1408",
              cursor: busy || !keyInput.trim() ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Live status line. */}
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {status === null ? (
            <span style={{ color: "var(--muted)" }}>Loading…</span>
          ) : status.set ? (
            <span style={{ color: "var(--foreground)" }}>
              Connected ✓ — sk-…{status.last4 ?? "????"}{" "}
              <span style={{ color: "var(--muted)" }}>
                (
                {status.source === "env"
                  ? "from environment variable"
                  : "from Settings"}
                )
              </span>
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>Not set</span>
          )}
        </div>

        {/* Precedence note: env wins if both are present. */}
        {status?.set && status.source === "env" && status.envPresent && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            An environment variable (ANTHROPIC_API_KEY) is set and takes
            precedence. A key saved here is used only if you remove it.
          </div>
        )}

        {saved && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
            Saved.
          </div>
        )}
        {error && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#f0a6a6" }}>
            {error}
          </div>
        )}

        {/* Clear is only meaningful when a key is saved to the file. */}
        {status?.source === "file" && (
          <div style={{ marginTop: 12 }}>
            <button onClick={clear} disabled={busy} style={SECONDARY_BTN}>
              Clear saved key
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          Get a key at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            console.anthropic.com
          </a>
          . It&apos;s stored locally on this machine only (in{" "}
          <code>~/.marcus-krispy/secrets.json</code>) and is never sent anywhere
          except Anthropic.
        </div>
      </div>

      {/* ---------------------- YouTube key ---------------------- */}
      <div style={PANEL}>
        <label
          htmlFor="youtube-key"
          style={{
            display: "block",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          YouTube Data API key (for Competitors)
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            id="youtube-key"
            type="password"
            value={ytInput}
            onChange={(e) => setYtInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveYouTube();
            }}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            style={INPUT}
          />
          <button
            onClick={saveYouTube}
            disabled={ytBusy || !ytInput.trim()}
            style={{
              ...PRIMARY_BTN,
              background: ytBusy || !ytInput.trim() ? "#3a3f47" : "var(--accent)",
              color: ytBusy || !ytInput.trim() ? "var(--muted)" : "#1a1408",
              cursor: ytBusy || !ytInput.trim() ? "not-allowed" : "pointer",
            }}
          >
            {ytBusy ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Live status line. */}
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {status === null ? (
            <span style={{ color: "var(--muted)" }}>Loading…</span>
          ) : yt?.set ? (
            <span style={{ color: "var(--foreground)" }}>
              Connected ✓ — …{yt.last4 ?? "????"}{" "}
              <span style={{ color: "var(--muted)" }}>
                (
                {yt.source === "env"
                  ? "from environment variable"
                  : "from Settings"}
                )
              </span>
            </span>
          ) : (
            <span style={{ color: "var(--muted)" }}>Not set</span>
          )}
        </div>

        {/* Precedence note: env wins if both are present. */}
        {yt?.set && yt.source === "env" && yt.envPresent && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
            An environment variable (YOUTUBE_DATA_API_KEY) is set and takes
            precedence. A key saved here is used only if you remove it.
          </div>
        )}

        {ytSaved && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
            Saved.
          </div>
        )}
        {ytError && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#f0a6a6" }}>
            {ytError}
          </div>
        )}

        {yt?.source === "file" && (
          <div style={{ marginTop: 12 }}>
            <button onClick={clearYouTube} disabled={ytBusy} style={SECONDARY_BTN}>
              Clear saved key
            </button>
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          A <strong>free</strong> key from{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            Google Cloud
          </a>
          : create a project, enable the <em>YouTube Data API v3</em>, then make
          an API key. It reads public channel data only (no login), is stored
          locally in <code>~/.marcus-krispy/secrets.json</code>, and is used only
          to call YouTube.
        </div>
      </div>
    </div>
  );
}
