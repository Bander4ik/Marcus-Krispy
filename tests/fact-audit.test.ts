/**
 * Pure-logic tests for the fact-audit input validator and message builder.
 */
import { describe, it, expect } from "vitest";
import {
  parseFactAuditInput,
  buildPhaseMessages,
  FactAuditInputError,
  type FactAuditInput,
} from "@/lib/script/fact-audit";
import {
  CONFIRM_REWRITE,
  CONFIRM_REAUDIT,
  type AuditTurn,
} from "@/lib/script/fact-audit-shared";

describe("parseFactAuditInput — validation", () => {
  it("rejects a non-object body", () => {
    expect(() => parseFactAuditInput(null)).toThrow(FactAuditInputError);
    expect(() => parseFactAuditInput("x")).toThrow(/Invalid request body/);
    expect(() => parseFactAuditInput(42)).toThrow(FactAuditInputError);
  });

  it("rejects an unknown phase", () => {
    expect(() =>
      parseFactAuditInput({ phase: "bogus", script: "hi" })
    ).toThrow(/Unknown phase/);
  });

  it("rejects an empty or whitespace-only script", () => {
    expect(() => parseFactAuditInput({ phase: "audit", script: "" })).toThrow(
      /No script to audit/
    );
    expect(() =>
      parseFactAuditInput({ phase: "audit", script: "   \n\t " })
    ).toThrow(/No script to audit/);
    expect(() => parseFactAuditInput({ phase: "audit" })).toThrow(
      /No script to audit/
    );
  });

  it("rejects rewrite/reaudit with no prior turns", () => {
    expect(() =>
      parseFactAuditInput({ phase: "rewrite", script: "the script" })
    ).toThrow(/Missing prior audit context/);
    expect(() =>
      parseFactAuditInput({ phase: "reaudit", script: "the script", turns: [] })
    ).toThrow(/Missing prior audit context/);
  });

  it("returns clean, trimmed data for a valid audit request", () => {
    const out = parseFactAuditInput({
      phase: "audit",
      script: "  hello world  ",
    });
    expect(out).toEqual({ phase: "audit", script: "hello world", turns: [] });
  });

  it("normalizes turns and drops junk for a valid rewrite request", () => {
    const out = parseFactAuditInput({
      phase: "rewrite",
      script: "the script",
      turns: [
        { role: "user", text: "the script" },
        { role: "bogus", text: "drop me" },
        { role: "assistant", text: "audit body" },
      ],
    });
    expect(out.phase).toBe("rewrite");
    expect(out.turns).toEqual([
      { role: "user", text: "the script" },
      { role: "assistant", text: "audit body" },
    ]);
  });
});

describe("buildPhaseMessages — Phase 1 (audit)", () => {
  it("produces a single user turn framing the script as <TEXT>", () => {
    const input: FactAuditInput = {
      phase: "audit",
      script: "Babolat racquets cost $250.",
      turns: [],
    };
    const msgs = buildPhaseMessages(input);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    const content = msgs[0].content as string;
    expect(content).toContain("<TEXT>");
    expect(content).toContain("</TEXT>");
    expect(content).toContain("Babolat racquets cost $250.");
    expect(content).toContain("Begin Phase 1 now");
  });

  it("falls back to the framed-script form when turns are empty even off-audit", () => {
    // Defensive: even if phase!=audit slips through with empty turns, we frame.
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "S",
      turns: [],
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content as string).toContain("<TEXT>");
  });
});

describe("buildPhaseMessages — Phase 2/3 replay", () => {
  const priorTurns: AuditTurn[] = [
    { role: "user", text: "Original script body." },
    { role: "assistant", text: "Phase 1 audit table…" },
    { role: "user", text: CONFIRM_REWRITE },
  ];

  it("re-frames the FIRST user turn (the script) as <TEXT>", () => {
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "Original script body.",
      turns: priorTurns,
    });
    const first = msgs[0].content as string;
    expect(first).toContain("<TEXT>");
    expect(first).toContain("Original script body.");
    expect(first).toContain("Begin Phase 1 now");
  });

  it("replays middle turns verbatim", () => {
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "Original script body.",
      turns: priorTurns,
    });
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("Phase 1 audit table…");
  });

  it("ends on a user turn carrying the canonical CONFIRM_REWRITE string", () => {
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "Original script body.",
      turns: priorTurns,
    });
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toBe(CONFIRM_REWRITE);
  });

  it("produces strictly ALTERNATING roles (user→assistant→user…)", () => {
    const fullTurns: AuditTurn[] = [
      { role: "user", text: "script" },
      { role: "assistant", text: "audit" },
      { role: "user", text: CONFIRM_REWRITE },
      { role: "assistant", text: "rewritten" },
      { role: "user", text: CONFIRM_REAUDIT },
    ];
    const msgs = buildPhaseMessages({
      phase: "reaudit",
      script: "script",
      turns: fullTurns,
    });
    for (let i = 0; i < msgs.length; i += 1) {
      expect(msgs[i].role).toBe(i % 2 === 0 ? "user" : "assistant");
    }
    expect(msgs[msgs.length - 1].content).toBe(CONFIRM_REAUDIT);
  });

  it("DEFENSIVELY appends the confirmation when turns end on an assistant turn", () => {
    // Client forgot to append the gating confirm — list ends on assistant.
    const turns: AuditTurn[] = [
      { role: "user", text: "script" },
      { role: "assistant", text: "audit body" },
    ];
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "script",
      turns,
    });
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toBe(CONFIRM_REWRITE);
    // The list must still end on a user turn.
    expect(msgs.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("uses CONFIRM_REAUDIT (not REWRITE) when defensively appending for reaudit", () => {
    const turns: AuditTurn[] = [
      { role: "user", text: "script" },
      { role: "assistant", text: "audit body" },
    ];
    const msgs = buildPhaseMessages({
      phase: "reaudit",
      script: "script",
      turns,
    });
    expect(msgs[msgs.length - 1].content).toBe(CONFIRM_REAUDIT);
  });

  it("does NOT double-append when the confirm is already the last user turn", () => {
    const turns: AuditTurn[] = [
      { role: "user", text: "script" },
      { role: "assistant", text: "audit" },
      { role: "user", text: CONFIRM_REWRITE },
    ];
    const msgs = buildPhaseMessages({
      phase: "rewrite",
      script: "script",
      turns,
    });
    const confirmCount = msgs.filter(
      (m) => m.content === CONFIRM_REWRITE
    ).length;
    expect(confirmCount).toBe(1);
    expect(msgs).toHaveLength(3);
  });
});
