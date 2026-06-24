/**
 * Round-trip tests for the NDJSON streaming protocol: encodeEvent (server) ↔
 * createEventParser (client), for every event type, plus chunked/partial input.
 */
import { describe, it, expect } from "vitest";
import {
  encodeEvent,
  createEventParser,
  type ScriptEvent,
} from "@/lib/script/protocol";

const ALL_EVENTS: ScriptEvent[] = [
  { type: "stage", stage: "research", status: "start" },
  {
    type: "stage",
    stage: "research",
    status: "done",
    outline: "- a\n- b",
    sources: [
      { url: "https://x.test", title: "X" },
      { url: "https://y.test" },
    ],
  },
  { type: "stage", stage: "draft", status: "start" },
  { type: "stage", stage: "audit", status: "start" },
  { type: "token", text: "hello " },
  { type: "token", text: "world" },
  { type: "done" },
  { type: "error", message: "boom" },
];

describe("encodeEvent", () => {
  it("emits one JSON object per line, newline-terminated", () => {
    const line = encodeEvent({ type: "token", text: "hi" });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.split("\n")).toHaveLength(2); // content + trailing empty
    expect(JSON.parse(line.trim())).toEqual({ type: "token", text: "hi" });
  });

  it("preserves the research-done outline + sources payload", () => {
    const ev = ALL_EVENTS[1];
    expect(JSON.parse(encodeEvent(ev).trim())).toEqual(ev);
  });
});

describe("createEventParser — full-line feeding", () => {
  it("round-trips every event type when fed the whole stream at once", () => {
    const parse = createEventParser();
    const wire = ALL_EVENTS.map(encodeEvent).join("");
    const out = parse(wire);
    expect(out).toEqual(ALL_EVENTS);
  });

  it("round-trips when each event is fed as its own chunk", () => {
    const parse = createEventParser();
    const out: ScriptEvent[] = [];
    for (const ev of ALL_EVENTS) out.push(...parse(encodeEvent(ev)));
    expect(out).toEqual(ALL_EVENTS);
  });
});

describe("createEventParser — partial / chunked input", () => {
  it("buffers a line split ACROSS two chunks and emits it once completed", () => {
    const parse = createEventParser();
    const line = encodeEvent({ type: "token", text: "spanning" }); // {...}\n
    const cut = Math.floor(line.length / 2);

    const first = parse(line.slice(0, cut)); // no newline yet
    expect(first).toEqual([]);

    const second = parse(line.slice(cut)); // completes the line
    expect(second).toEqual([{ type: "token", text: "spanning" }]);
  });

  it("handles a chunk boundary that lands exactly on the newline", () => {
    const parse = createEventParser();
    const line = encodeEvent({ type: "done" });
    const body = line.slice(0, -1); // without "\n"
    expect(parse(body)).toEqual([]); // still buffered
    expect(parse("\n")).toEqual([{ type: "done" }]);
  });

  it("emits multiple complete events and buffers a trailing partial", () => {
    const parse = createEventParser();
    const a = encodeEvent({ type: "token", text: "a" });
    const b = encodeEvent({ type: "token", text: "b" });
    const cPartial = '{"type":"token","text":"c"'; // no closing brace/newline

    const out = parse(a + b + cPartial);
    expect(out).toEqual([
      { type: "token", text: "a" },
      { type: "token", text: "b" },
    ]);
    // Completing c later yields it.
    expect(parse('}\n')).toEqual([{ type: "token", text: "c" }]);
  });

  it("reassembles a stream cut at arbitrary byte offsets", () => {
    const wire = ALL_EVENTS.map(encodeEvent).join("");
    const parse = createEventParser();
    const out: ScriptEvent[] = [];
    // Feed 3 chars at a time.
    for (let i = 0; i < wire.length; i += 3) {
      out.push(...parse(wire.slice(i, i + 3)));
    }
    expect(out).toEqual(ALL_EVENTS);
  });
});

describe("createEventParser — robustness", () => {
  it("ignores blank lines (and whitespace-only lines)", () => {
    const parse = createEventParser();
    const out = parse(
      "\n   \n" +
        encodeEvent({ type: "token", text: "x" }) +
        "\n\n" +
        encodeEvent({ type: "done" })
    );
    expect(out).toEqual([{ type: "token", text: "x" }, { type: "done" }]);
  });

  it("ignores malformed JSON lines without breaking the stream", () => {
    const parse = createEventParser();
    const out = parse(
      "{not valid json}\n" +
        encodeEvent({ type: "token", text: "ok" }) +
        "garbage line\n" +
        encodeEvent({ type: "done" })
    );
    expect(out).toEqual([{ type: "token", text: "ok" }, { type: "done" }]);
  });

  it("does not emit anything for an empty chunk", () => {
    const parse = createEventParser();
    expect(parse("")).toEqual([]);
  });
});

describe("createEventParser — token payloads that look like the wire format", () => {
  // The script/audit text is arbitrary: it can contain newlines, braces, and
  // even text that itself looks like a protocol JSON line. JSON.stringify
  // escapes newlines as \n INSIDE the string, so each event is still exactly one
  // physical line — the line framing must never be broken by token contents.

  it("a token whose text contains real newlines stays a single wire line", () => {
    const ev = { type: "token", text: "para one\npara two\n\npara three" } as const;
    const line = encodeEvent(ev);
    // Encoded form: the embedded newlines are escaped, so there is exactly ONE
    // physical newline (the trailing record separator).
    expect(line.match(/\n/g)).toHaveLength(1);
    expect(line.endsWith("\n")).toBe(true);
    expect(createEventParser()(line)).toEqual([ev]);
  });

  it("round-trips a token that literally looks like a protocol line", () => {
    // Model emits text identical to another NDJSON event. It must come back as
    // the token text, not be re-interpreted as a second event.
    const sneaky = '{"type":"done"}\n{"type":"error","message":"pwned"}';
    const ev = { type: "token", text: sneaky } as const;
    const out = createEventParser()(encodeEvent(ev));
    expect(out).toEqual([ev]);
    expect(out).toHaveLength(1);
    expect((out[0] as { text: string }).text).toBe(sneaky);
  });

  it("survives a }-heavy / brace-laden script token", () => {
    const ev = {
      type: "token",
      text: "}}}{{{ if (x) { return {a:1}; } } else }}}",
    } as const;
    expect(createEventParser()(encodeEvent(ev))).toEqual([ev]);
  });

  it("round-trips a token streamed one BYTE at a time without splitting on inner newlines", () => {
    const ev = { type: "token", text: "a\nb\nc}\n{d" } as const;
    const wire = encodeEvent(ev);
    const parse = createEventParser();
    const out: ScriptEvent[] = [];
    for (const ch of wire) out.push(...parse(ch));
    expect(out).toEqual([ev]);
  });

  it("handles a multi-token stream where every token contains newlines + braces", () => {
    const evs: ScriptEvent[] = [
      { type: "token", text: "line1\nline2" },
      { type: "token", text: "}{}{\n}" },
      { type: "token", text: '{"type":"token","text":"x"}' },
      { type: "done" },
    ];
    const wire = evs.map(encodeEvent).join("");
    expect(createEventParser()(wire)).toEqual(evs);
  });
});
