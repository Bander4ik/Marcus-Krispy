/**
 * Shared fact-audit contract — types + constants used by BOTH the client
 * (app/script/page.tsx) and the server (lib/script/fact-audit.ts, the route).
 *
 * This module has NO runtime dependencies (no SDK, no Node APIs) so the client
 * can import it without pulling server-only code into the browser bundle. The
 * server-side logic that calls the model lives in lib/script/fact-audit.ts.
 */

/** The three interactive phases of the audit. */
export type AuditPhase = "audit" | "rewrite" | "reaudit";

/** All valid phases, in order — the single source of truth for validation. */
export const AUDIT_PHASES: readonly AuditPhase[] = [
  "audit",
  "rewrite",
  "reaudit",
] as const;

export function isAuditPhase(value: unknown): value is AuditPhase {
  return (
    typeof value === "string" && AUDIT_PHASES.includes(value as AuditPhase)
  );
}

/**
 * One turn of the running conversation as the CLIENT tracks it. `text` is the
 * visible body of that turn (the script, a confirmation, or a phase's body).
 * The client replays these to the server each call so the model keeps the
 * script + every prior phase as context.
 */
export interface AuditTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * The exact user-message text that gates each post-audit phase. Defined ONCE
 * here so the client builds well-formed, alternating turns and the server
 * receives them verbatim — no duplication, no role-adjacency violations.
 */
export const CONFIRM_REWRITE =
  "Confirmed — rewrite the TEXT now using the proposed verified replacements " +
  "and/or hedged generalizations, preserving voice and keeping length within " +
  "±3%. Output ONLY the rewritten text per the Phase 2 rule.";

export const CONFIRM_REAUDIT =
  "Confirmed — run a full re-audit of the rewritten text above (Phase 3), " +
  "using R-prefixed claim IDs and a delta summary.";

/** Coerces an unknown `turns` value into a clean AuditTurn[] (drops junk). */
export function normalizeTurns(value: unknown): AuditTurn[] {
  if (!Array.isArray(value)) return [];
  const out: AuditTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const role =
      t.role === "assistant"
        ? "assistant"
        : t.role === "user"
          ? "user"
          : null;
    const text = typeof t.text === "string" ? t.text : null;
    if (!role || text === null) continue;
    out.push({ role, text });
  }
  return out;
}
