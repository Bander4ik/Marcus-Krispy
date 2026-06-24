/**
 * Pure-logic tests for the shared fact-audit contract (no SDK, no Node IO).
 */
import { describe, it, expect } from "vitest";
import {
  AUDIT_PHASES,
  CONFIRM_REAUDIT,
  CONFIRM_REWRITE,
  isAuditPhase,
  normalizeTurns,
} from "@/lib/script/fact-audit-shared";

describe("AUDIT_PHASES", () => {
  it("is exactly audit → rewrite → reaudit, in order", () => {
    expect([...AUDIT_PHASES]).toEqual(["audit", "rewrite", "reaudit"]);
  });
});

describe("isAuditPhase", () => {
  it("accepts the three valid phases", () => {
    expect(isAuditPhase("audit")).toBe(true);
    expect(isAuditPhase("rewrite")).toBe(true);
    expect(isAuditPhase("reaudit")).toBe(true);
  });

  it("rejects unknown / non-string values", () => {
    expect(isAuditPhase("nope")).toBe(false);
    expect(isAuditPhase("")).toBe(false);
    expect(isAuditPhase(undefined)).toBe(false);
    expect(isAuditPhase(null)).toBe(false);
    expect(isAuditPhase(1)).toBe(false);
    expect(isAuditPhase({ phase: "audit" })).toBe(false);
  });
});

describe("confirmation constants", () => {
  it("CONFIRM_REWRITE names Phase 2 and the ±3% length rule", () => {
    expect(CONFIRM_REWRITE).toContain("Phase 2");
    expect(CONFIRM_REWRITE).toContain("±3%");
    expect(CONFIRM_REWRITE.length).toBeGreaterThan(20);
  });

  it("CONFIRM_REAUDIT names Phase 3 and R-prefixed IDs", () => {
    expect(CONFIRM_REAUDIT).toContain("Phase 3");
    expect(CONFIRM_REAUDIT).toContain("R-prefixed");
  });

  it("the two confirmations are distinct", () => {
    expect(CONFIRM_REWRITE).not.toBe(CONFIRM_REAUDIT);
  });
});

describe("normalizeTurns", () => {
  it("returns [] for non-arrays", () => {
    expect(normalizeTurns(undefined)).toEqual([]);
    expect(normalizeTurns(null)).toEqual([]);
    expect(normalizeTurns("x")).toEqual([]);
    expect(normalizeTurns({})).toEqual([]);
  });

  it("keeps well-formed user/assistant turns", () => {
    const out = normalizeTurns([
      { role: "user", text: "hi" },
      { role: "assistant", text: "yo" },
    ]);
    expect(out).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "yo" },
    ]);
  });

  it("drops junk: bad roles, missing text, non-objects", () => {
    const out = normalizeTurns([
      { role: "system", text: "nope" }, // bad role
      { role: "user" }, // missing text
      { role: "user", text: 5 }, // non-string text
      null,
      "string",
      42,
      { role: "assistant", text: "" }, // empty string IS valid text
    ]);
    expect(out).toEqual([{ role: "assistant", text: "" }]);
  });

  it("preserves order of valid turns", () => {
    const out = normalizeTurns([
      { role: "user", text: "1" },
      { role: "garbage", text: "skip" },
      { role: "assistant", text: "2" },
      { role: "user", text: "3" },
    ]);
    expect(out.map((t) => t.text)).toEqual(["1", "2", "3"]);
  });
});
