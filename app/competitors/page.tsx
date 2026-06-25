"use client";

/**
 * Competitors / Outliers tab.
 *
 * Scans the saved competitor channels for "outliers" — videos doing notably
 * better than THAT channel's usual (median) views — and surfaces them as topic
 * ideas. Each outlier has a "Make script" button that hands its title to the
 * Script tab (navigate to /script?title=<encoded>).
 *
 * Scheduling: the app runs LOCALLY, not 24/7. On open we read the saved state
 * (GET /api/competitors/scan); if a YouTube key is set AND the last scan is ≥2
 * days ago (or never), we auto-trigger ONE scan. A manual "Scan now" button is
 * always available. The last-scan time + "next due" are shown.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

/** Scan every N days (the app is local, so this is "≥N days since last scan"). */
const SCAN_INTERVAL_DAYS = 2;
const DAY_MS = 86_400_000;

interface Outlier {
  videoId: string;
  title: string;
  channelHandle: string;
  views: number;
  multiple: number;
  publishedAt: string;
  videoUrl: string;
  ageDays: number;
}

interface ScanState {
  channels: string[];
  lastScanAt: string | null;
  outliers: Outlier[];
  errors?: Array<{ handle: string; message: string }>;
}

/** "3 days ago" / "5 hours ago" / "just now" from an ISO timestamp. */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** True when a scan is due (never scanned, or ≥ SCAN_INTERVAL_DAYS ago). */
function isScanDue(lastScanAt: string | null): boolean {
  if (!lastScanAt) return true;
  const then = Date.parse(lastScanAt);
  if (Number.isNaN(then)) return true;
  return Date.now() - then >= SCAN_INTERVAL_DAYS * DAY_MS;
}

/** Human "next due" hint based on the last scan + the interval. */
function nextDueLabel(lastScanAt: string | null): string {
  if (!lastScanAt) return "due now";
  const due = Date.parse(lastScanAt) + SCAN_INTERVAL_DAYS * DAY_MS;
  const diff = due - Date.now();
  if (diff <= 0) return "due now";
  const hours = Math.ceil(diff / 3_600_000);
  if (hours < 24) return `next due in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(hours / 24);
  return `next due in ${days} day${days === 1 ? "" : "s"}`;
}

/** Compact view count (1.2M / 340K / 980). */
function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Compact age from whole days (today / 3d / 5w / 4mo / 2y). */
function fmtAge(days: number): string {
  if (days <= 0) return "today";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export default function CompetitorsPage() {
  const router = useRouter();
  const [state, setState] = useState<ScanState | null>(null);
  const [newHandle, setNewHandle] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [keySet, setKeySet] = useState<boolean | null>(null);
  // Guards the auto-scan-on-open so it fires at most once per mount.
  const autoScanTriedRef = useRef(false);

  /** Runs a scan (POST), updating state from the response. */
  const runScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/competitors/scan", { method: "POST" });
      const data = (await res.json()) as ScanState & { error?: string };
      if (!res.ok) throw new Error(data.error || `Scan failed (${res.status}).`);
      setState({
        channels: data.channels,
        lastScanAt: data.lastScanAt,
        outliers: data.outliers ?? [],
        errors: data.errors,
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }, []);

  // On mount: load saved state + key status, then auto-scan if due + key set.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [scanRes, settingsRes] = await Promise.all([
          fetch("/api/competitors/scan"),
          fetch("/api/settings"),
        ]);
        if (!scanRes.ok) throw new Error(`Load failed (${scanRes.status}).`);
        const scanData = (await scanRes.json()) as ScanState;
        let youtubeSet = false;
        if (settingsRes.ok) {
          const s = (await settingsRes.json()) as {
            youtube?: { set?: boolean };
          };
          youtubeSet = Boolean(s.youtube?.set);
        }
        if (!active) return;
        setState(scanData);
        setKeySet(youtubeSet);

        // Auto-scan once if a key is set and a scan is due.
        if (
          !autoScanTriedRef.current &&
          youtubeSet &&
          isScanDue(scanData.lastScanAt)
        ) {
          autoScanTriedRef.current = true;
          void runScan();
        }
      } catch {
        if (active) setLoadError("Couldn't load the Competitors data.");
      }
    })();
    return () => {
      active = false;
    };
  }, [runScan]);

  async function addHandle() {
    const handle = newHandle.trim();
    if (!handle) return;
    try {
      const res = await fetch("/api/competitors/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = (await res.json()) as { channels?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't add the channel.");
      setNewHandle("");
      setState((prev) =>
        prev ? { ...prev, channels: data.channels ?? prev.channels } : prev
      );
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Couldn't add the channel.");
    }
  }

  async function removeHandle(handle: string) {
    try {
      const res = await fetch(
        `/api/competitors/channels?handle=${encodeURIComponent(handle)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { channels?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't remove the channel.");
      setState((prev) =>
        prev ? { ...prev, channels: data.channels ?? prev.channels } : prev
      );
    } catch (e) {
      setScanError(
        e instanceof Error ? e.message : "Couldn't remove the channel."
      );
    }
  }

  /** Make-script handoff: pre-fill the Script tab with this title. */
  function makeScript(title: string) {
    router.push(`/script?title=${encodeURIComponent(title)}`);
  }

  const channels = state?.channels ?? [];
  const outliers = state?.outliers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Competitors / Outliers</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Over-performing videos from competitor channels — ranked by how far
          they beat that channel&apos;s usual views. Turn one into a script.
        </p>
      </div>

      {/* No-key notice. */}
      {keySet === false && (
        <div
          style={{
            ...PANEL,
            borderColor: "var(--accent)",
            fontSize: 14,
            color: "var(--foreground)",
          }}
        >
          A <strong>YouTube Data API key</strong> is needed to scan. Add it in{" "}
          <a href="/settings" style={{ color: "var(--accent)" }}>
            Settings
          </a>{" "}
          (a free key from Google Cloud). The channel list below is editable
          without a key.
        </div>
      )}

      {loadError && (
        <div style={{ ...PANEL, borderColor: "#7a2e2e", color: "#f0a6a6" }}>
          {loadError}
        </div>
      )}

      {/* Scan controls + status. */}
      <div style={PANEL}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={runScan}
            disabled={scanning || channels.length === 0}
            style={{
              ...PRIMARY_BTN,
              background:
                scanning || channels.length === 0 ? "#3a3f47" : "var(--accent)",
              color:
                scanning || channels.length === 0 ? "var(--muted)" : "#1a1408",
              cursor:
                scanning || channels.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? "Scanning…" : "Scan now"}
          </button>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Last scanned <strong style={{ color: "var(--foreground)" }}>
              {timeAgo(state?.lastScanAt ?? null)}
            </strong>
            {" · "}
            {state ? nextDueLabel(state.lastScanAt) : "—"}
            {" · scans every "}
            {SCAN_INTERVAL_DAYS} days when you open this tab
          </span>
        </div>

        {scanError && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#f0a6a6" }}>
            {scanError}
          </div>
        )}

        {/* Per-channel scan warnings (e.g. an unresolved handle). */}
        {state?.errors && state.errors.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            {state.errors.length} channel
            {state.errors.length === 1 ? "" : "s"} couldn&apos;t be scanned:{" "}
            {state.errors.map((e) => e.handle).join(", ")}.
          </div>
        )}
      </div>

      {/* Channel-list management. */}
      <div style={PANEL}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
          Competitor channels ({channels.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {channels.map((h) => (
            <span
              key={h}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "5px 8px 5px 10px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--background)",
              }}
            >
              {h}
              <button
                onClick={() => removeHandle(h)}
                title={`Remove ${h}`}
                aria-label={`Remove ${h}`}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
          {channels.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              No channels yet — add one below.
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addHandle();
            }}
            placeholder="@channelHandle or a channel URL"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: "1 1 240px",
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
            onClick={addHandle}
            disabled={!newHandle.trim()}
            style={{
              ...SECONDARY_BTN,
              color: newHandle.trim() ? "var(--foreground)" : "var(--muted)",
              cursor: newHandle.trim() ? "pointer" : "not-allowed",
            }}
          >
            Add channel
          </button>
        </div>
      </div>

      {/* Outlier results. */}
      <div style={PANEL}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Outliers {outliers.length > 0 && `(${outliers.length})`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            ranked by × usual views
          </div>
        </div>

        {outliers.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--muted)", padding: "8px 0" }}>
            {scanning
              ? "Scanning competitor channels…"
              : state?.lastScanAt
                ? "No outliers in the last scan. Try again later or adjust the channel list."
                : keySet === false
                  ? "Add a YouTube key in Settings, then Scan now."
                  : "No scan yet — click “Scan now”."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {outliers.map((o) => (
              <div
                key={o.videoId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  flexWrap: "wrap",
                }}
              >
                {/* "N× usual" badge. */}
                <span
                  title="Views vs this channel's median (usual) views"
                  style={{
                    flex: "0 0 auto",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1a1408",
                    background: "var(--accent)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    minWidth: 52,
                    textAlign: "center",
                  }}
                >
                  {o.multiple}×
                </span>

                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--foreground)",
                      lineHeight: 1.35,
                    }}
                  >
                    {o.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {o.channelHandle} · {fmtViews(o.views)} views · {fmtAge(o.ageDays)}
                    {" · "}
                    <a
                      href={o.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)" }}
                    >
                      watch
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => makeScript(o.title)}
                  style={{
                    ...SECONDARY_BTN,
                    flex: "0 0 auto",
                    fontSize: 13,
                    padding: "7px 12px",
                  }}
                >
                  Make script →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
