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

interface KeyStatus {
  set: boolean;
  source: "env" | "file" | null;
  last4: string | null;
  envPresent: boolean;
  model?: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load the current (masked) status on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const data = (await res.json()) as KeyStatus;
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
      const data = (await res.json()) as KeyStatus & { error?: string };
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
      const data = (await res.json()) as KeyStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Settings</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Connect your Anthropic API key so the Script tab can run.
        </p>
      </div>

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
          Anthropic API key
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
            style={{
              flex: "1 1 280px",
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={save}
            disabled={busy || !keyInput.trim()}
            style={{
              ...PRIMARY_BTN,
              background:
                busy || !keyInput.trim() ? "#3a3f47" : "var(--accent)",
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

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Get a key at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            console.anthropic.com
          </a>
          . It's stored locally on this machine only (in
          {" "}
          <code>~/.marcus-krispy/secrets.json</code>) and is never sent anywhere
          except Anthropic.
        </div>
      </div>
    </div>
  );
}
