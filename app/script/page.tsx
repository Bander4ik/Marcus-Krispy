"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createEventParser } from "@/lib/script/protocol";
import type { SourceLink } from "@/lib/script/types";
import {
  CONFIRM_REAUDIT,
  CONFIRM_REWRITE,
  type AuditTurn,
} from "@/lib/script/fact-audit-shared";
import { Markdown } from "@/app/script/Markdown";

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

type StageState = "idle" | "active" | "done";

interface Stages {
  research: StageState;
  draft: StageState;
}

const STAGE_LABELS: Record<keyof Stages, { active: string; done: string }> = {
  research: { active: "Researching sources…", done: "Research & outline" },
  draft: { active: "Writing script…", done: "Script written" },
};

/** Which audit phases have completed, for rendering the right next action. */
type AuditStep = "none" | "audited" | "rewritten" | "reaudited";

/** True when an error is the "no Anthropic key" case, so we can link Settings. */
function isMissingKeyError(message: string): boolean {
  return /ANTHROPIC_API_KEY/i.test(message);
}

export default function ScriptPage() {
  const [title, setTitle] = useState("");
  const [channelId] = useState("tennistimez");
  const [script, setScript] = useState("");
  const [outline, setOutline] = useState("");
  const [sources, setSources] = useState<SourceLink[]>([]);
  const [stages, setStages] = useState<Stages>({
    research: "idle",
    draft: "idle",
  });
  const [showOutline, setShowOutline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Fact audit (Step 3) state ---
  const [auditTurns, setAuditTurns] = useState<AuditTurn[]>([]);
  const [auditReport, setAuditReport] = useState(""); // streamed Phase-1/3 body
  const [rewritten, setRewritten] = useState(""); // streamed Phase-2 body
  const [reauditReport, setReauditReport] = useState(""); // streamed Phase-3 body
  const [auditStep, setAuditStep] = useState<AuditStep>("none");
  const [auditPhase, setAuditPhase] = useState<
    null | "audit" | "rewrite" | "reaudit"
  >(null); // non-null while a phase is streaming
  const [auditError, setAuditError] = useState<string | null>(null);
  const [rewrittenCopied, setRewrittenCopied] = useState(false);

  async function generate() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    setScript("");
    setOutline("");
    setSources([]);
    setStages({ research: "idle", draft: "idle" });
    setShowOutline(false);
    setCopied(false);
    resetAudit();
    const start = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(
      () => setElapsed((Date.now() - start) / 1000),
      100
    );

    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, channelId }),
      });

      if (!res.ok || !res.body) {
        // Pre-stream failures (missing key, bad channel) come back as JSON.
        let msg = `Request failed (${res.status}).`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parse = createEventParser();
      let streamError: string | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const events = parse(decoder.decode(value, { stream: true }));
        for (const event of events) {
          switch (event.type) {
            case "stage":
              if (event.status === "start") {
                setStages((s) => ({ ...s, [event.stage]: "active" }));
              } else if (event.stage === "research") {
                setOutline(event.outline);
                setSources(event.sources);
                setStages((s) => ({ ...s, research: "done" }));
              }
              break;
            case "token":
              setScript((prev) => prev + event.text);
              break;
            case "done":
              setStages((s) => ({ ...s, draft: "done" }));
              break;
            case "error":
              streamError = event.message;
              break;
          }
        }
      }

      if (streamError) throw new Error(streamError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ---- Fact audit ----

  function resetAudit() {
    setAuditTurns([]);
    setAuditReport("");
    setRewritten("");
    setReauditReport("");
    setAuditStep("none");
    setAuditPhase(null);
    setAuditError(null);
    setRewrittenCopied(false);
  }

  /**
   * Streams one audit phase, accumulating its text into `onToken`, and returns
   * the full text on success. Holds the running conversation in `auditTurns`,
   * which we replay to the server each call so the model keeps the script +
   * prior phases as context. Throws on stream/HTTP error.
   */
  async function runAuditPhase(
    phase: "audit" | "rewrite" | "reaudit",
    turns: AuditTurn[],
    onToken: (full: string) => void
  ): Promise<string> {
    const res = await fetch("/api/fact-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, script, turns, channelId }),
    });

    if (!res.ok || !res.body) {
      let msg = `Request failed (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* keep default */
      }
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parse = createEventParser();
    let acc = "";
    let streamError: string | null = null;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const events = parse(decoder.decode(value, { stream: true }));
      for (const event of events) {
        if (event.type === "token") {
          acc += event.text;
          onToken(acc);
        } else if (event.type === "error") {
          streamError = event.message;
        }
      }
    }

    if (streamError) throw new Error(streamError);
    return acc;
  }

  /** Phase 1 — audit the current script. */
  async function startAudit() {
    if (!script.trim() || auditPhase) return;
    setAuditError(null);
    setAuditReport("");
    setRewritten("");
    setReauditReport("");
    setAuditStep("none");
    setAuditPhase("audit");
    try {
      // Phase 1 sends no prior turns; the server frames the script itself.
      const report = await runAuditPhase("audit", [], setAuditReport);
      // Seed the conversation: the framed script is the user turn the server
      // built, but for replay we store the visible turns. We mirror the
      // server's turn shape: user=the script, assistant=the audit.
      setAuditTurns([
        { role: "user", text: script },
        { role: "assistant", text: report },
      ]);
      setAuditStep("audited");
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Fact audit failed.");
    } finally {
      setAuditPhase(null);
    }
  }

  /** Phase 2 — rewrite with the proposed fixes (after the user confirms). */
  async function startRewrite() {
    if (auditPhase || auditStep === "none") return;
    setAuditError(null);
    setRewritten("");
    setReauditReport("");
    setAuditPhase("rewrite");
    try {
      // Append the canonical confirmation as a user turn so the conversation
      // alternates user/assistant correctly, then run Phase 2.
      const turns: AuditTurn[] = [
        ...auditTurns,
        { role: "user", text: CONFIRM_REWRITE },
      ];
      const text = await runAuditPhase("rewrite", turns, setRewritten);
      setAuditTurns([...turns, { role: "assistant", text }]);
      setAuditStep("rewritten");
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Rewrite failed.");
    } finally {
      setAuditPhase(null);
    }
  }

  /** Phase 3 — re-audit the rewritten text (after the user confirms). */
  async function startReaudit() {
    if (auditPhase || auditStep !== "rewritten") return;
    setAuditError(null);
    setReauditReport("");
    setAuditPhase("reaudit");
    try {
      const turns: AuditTurn[] = [
        ...auditTurns,
        { role: "user", text: CONFIRM_REAUDIT },
      ];
      const text = await runAuditPhase("reaudit", turns, setReauditReport);
      setAuditTurns([...turns, { role: "assistant", text }]);
      setAuditStep("reaudited");
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Re-audit failed.");
    } finally {
      setAuditPhase(null);
    }
  }

  /** Replace the working script with the rewritten one (and clear the audit). */
  function adoptRewrite() {
    if (!rewritten.trim()) return;
    setScript(rewritten);
    resetAudit();
  }

  async function copyRewritten() {
    await navigator.clipboard.writeText(rewritten);
    setRewrittenCopied(true);
    setTimeout(() => setRewrittenCopied(false), 1500);
  }

  const showProgress = busy || stages.research !== "idle";
  const scriptReady = Boolean(script.trim()) && stages.draft === "done";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={PANEL}>
        <label
          htmlFor="title"
          style={{
            display: "block",
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Video title / idea
        </label>
        <textarea
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 5 tennis brands robbing you blind (and 5 worth every penny)"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={generate}
            disabled={busy || !title.trim()}
            style={{
              ...PRIMARY_BTN,
              background: busy || !title.trim() ? "#3a3f47" : "var(--accent)",
              color: busy || !title.trim() ? "var(--muted)" : "#1a1408",
              cursor: busy || !title.trim() ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Generating…" : "Generate script"}
          </button>

          {/* Step 3 — fact audit. Enabled once a script has been generated. */}
          <button
            type="button"
            onClick={startAudit}
            disabled={!scriptReady || busy || auditPhase !== null}
            title={
              scriptReady
                ? "Audit this script for factual accuracy"
                : "Generate a script first"
            }
            style={{
              ...SECONDARY_BTN,
              color:
                !scriptReady || busy || auditPhase !== null
                  ? "var(--muted)"
                  : "var(--foreground)",
              cursor:
                !scriptReady || busy || auditPhase !== null
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {auditPhase === "audit" ? "Auditing…" : "Fact-check"}
          </button>

          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Channel: {channelId} · two-stage pipeline (research → script)
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...PANEL,
            borderColor: "#7a2e2e",
            color: "#f0a6a6",
            fontSize: 14,
          }}
        >
          {error}
          {isMissingKeyError(error) && (
            <>
              {" "}
              <Link href="/settings" style={{ color: "var(--accent)" }}>
                Add your Anthropic API key in Settings.
              </Link>
            </>
          )}
        </div>
      )}

      {showProgress && (
        <div style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 8 }}>
          <StageRow state={stages.research} label="research" />
          <StageRow state={stages.draft} label="draft" />
        </div>
      )}

      {(outline || sources.length > 0) && (
        <div style={PANEL}>
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--foreground)",
              fontSize: 13,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span style={{ color: "var(--muted)" }}>
              {showOutline ? "▾" : "▸"}
            </span>
            Research &amp; outline
            {sources.length > 0 && (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                · {sources.length} source{sources.length === 1 ? "" : "s"}
              </span>
            )}
          </button>

          {showOutline && (
            <div style={{ marginTop: 12 }}>
              {outline && (
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--foreground)",
                    fontFamily: "inherit",
                  }}
                >
                  {outline}
                </pre>
              )}
              {sources.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginBottom: 6,
                    }}
                  >
                    Sources
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {sources.map((s) => (
                      <li key={s.url} style={{ marginBottom: 4 }}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent)", fontSize: 13 }}
                        >
                          {s.title || s.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(script || stages.draft !== "idle") && (
        <div style={PANEL}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Script</span>
            <button
              onClick={copy}
              disabled={!script}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                cursor: script ? "pointer" : "default",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            value={script}
            readOnly
            rows={18}
            style={{
              width: "100%",
              resize: "vertical",
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              fontSize: 14,
              lineHeight: 1.55,
              fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {script.split(/\s+/).filter(Boolean).length} words ·{" "}
            {elapsed.toFixed(1)}s
          </div>
        </div>
      )}

      {/* ===================== Fact audit (Step 3) ===================== */}

      {auditError && (
        <div
          style={{
            ...PANEL,
            borderColor: "#7a2e2e",
            color: "#f0a6a6",
            fontSize: 14,
          }}
        >
          {auditError}
          {isMissingKeyError(auditError) && (
            <>
              {" "}
              <Link href="/settings" style={{ color: "var(--accent)" }}>
                Add your Anthropic API key in Settings.
              </Link>
            </>
          )}
        </div>
      )}

      {/* Phase 1 — audit report. */}
      {(auditPhase === "audit" || auditReport) && (
        <AuditReportPanel
          heading="Fact audit"
          subtitle="Phase 1 — claims, evidence, and a rewrite proposal"
          streaming={auditPhase === "audit"}
          streamingLabel="Auditing — verifying claims online…"
          body={auditReport}
        >
          {auditStep === "audited" && auditPhase === null && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={startRewrite} style={PRIMARY_BTN}>
                Rewrite with fixes
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
                Applies the verified replacements / hedges, keeps length within ±3%.
              </span>
            </div>
          )}
        </AuditReportPanel>
      )}

      {/* Phase 2 — rewritten script. */}
      {(auditPhase === "rewrite" || rewritten) && (
        <div style={PANEL}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Rewritten script
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Phase 2 — fact-corrected, voice preserved
              </div>
            </div>
            <button
              onClick={copyRewritten}
              disabled={!rewritten}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                cursor: rewritten ? "pointer" : "default",
              }}
            >
              {rewrittenCopied ? "Copied" : "Copy"}
            </button>
          </div>

          {auditPhase === "rewrite" && !rewritten && (
            <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 8 }}>
              Rewriting…
            </div>
          )}

          <textarea
            value={rewritten}
            readOnly
            rows={16}
            style={{
              width: "100%",
              resize: "vertical",
              background: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              fontSize: 14,
              lineHeight: 1.55,
              fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {rewritten.split(/\s+/).filter(Boolean).length} words
          </div>

          {auditStep === "rewritten" && auditPhase === null && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={startReaudit} style={PRIMARY_BTN}>
                Run re-audit
              </button>
              <button type="button" onClick={adoptRewrite} style={SECONDARY_BTN}>
                Use as working script
              </button>
            </div>
          )}
          {auditStep === "reaudited" && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={adoptRewrite} style={SECONDARY_BTN}>
                Use as working script
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase 3 — re-audit report. */}
      {(auditPhase === "reaudit" || reauditReport) && (
        <AuditReportPanel
          heading="Re-audit"
          subtitle="Phase 3 — fresh audit of the rewrite, with a delta summary"
          streaming={auditPhase === "reaudit"}
          streamingLabel="Re-auditing — re-verifying the rewrite…"
          body={reauditReport}
        />
      )}
    </div>
  );
}

/** A panel that renders a streamed markdown audit report (Phase 1 or 3). */
function AuditReportPanel({
  heading,
  subtitle,
  streaming,
  streamingLabel,
  body,
  children,
}: {
  heading: string;
  subtitle: string;
  streaming: boolean;
  streamingLabel: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={PANEL}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{heading}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</div>
      </div>
      {streaming && !body && (
        <div style={{ fontSize: 13, color: "var(--accent)" }}>
          {streamingLabel}
        </div>
      )}
      {body && (
        <div
          style={{
            color: "var(--foreground)",
            maxHeight: 560,
            overflowY: "auto",
          }}
        >
          <Markdown text={body} />
        </div>
      )}
      {children}
    </div>
  );
}

/** One stage row in the progress panel. */
function StageRow({
  state,
  label,
}: {
  state: StageState;
  label: keyof Stages;
}) {
  const text =
    state === "done"
      ? STAGE_LABELS[label].done + " ✓"
      : state === "active"
        ? STAGE_LABELS[label].active
        : label === "research"
          ? "Research & outline"
          : "Script";

  const color =
    state === "done"
      ? "var(--foreground)"
      : state === "active"
        ? "var(--accent)"
        : "var(--muted)";

  const marker = state === "done" ? "●" : state === "active" ? "◐" : "○";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color, fontSize: 12 }}>{marker}</span>
      <span style={{ color, fontSize: 14 }}>{text}</span>
    </div>
  );
}
