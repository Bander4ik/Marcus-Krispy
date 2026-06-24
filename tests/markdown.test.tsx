/**
 * Tests for the dependency-free Markdown renderer (app/script/Markdown.tsx).
 *
 * Rendered to static HTML via react-dom/server — no jsdom needed, since Markdown
 * is pure given its `text` prop. Covers the constructs the fact audit emits:
 * headings, bold, links, GitHub tables, bullet/numbered lists, hr, paragraphs.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/app/script/Markdown";

function html(text: string): string {
  return renderToStaticMarkup(<Markdown text={text} />);
}

describe("Markdown — inline", () => {
  it("renders **bold** as <strong>", () => {
    expect(html("a **bold** word")).toContain("<strong>bold</strong>");
  });

  it("renders [text](url) as an external link", () => {
    const out = html("see [Tennis Warehouse](https://tw.test/page)");
    expect(out).toContain('href="https://tw.test/page"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain("Tennis Warehouse");
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("combines a link and bold in the same line", () => {
    const out = html("**Verdict:** [proof](https://p.test)");
    expect(out).toContain("<strong>Verdict:</strong>");
    expect(out).toContain('href="https://p.test"');
  });
});

describe("Markdown — block constructs", () => {
  it("renders ATX headings (level → larger font weight 700 div)", () => {
    const out = html("# Audit\n## Section");
    expect(out).toContain("Audit");
    expect(out).toContain("Section");
    expect(out).toContain("font-weight:700");
  });

  it("renders bullet lists as <ul><li>", () => {
    const out = html("- one\n- two\n- three");
    expect(out).toContain("<ul");
    expect((out.match(/<li/g) ?? []).length).toBe(3);
    expect(out).toContain("one");
    expect(out).toContain("three");
  });

  it("renders numbered lists as <ol><li>", () => {
    const out = html("1. first\n2. second");
    expect(out).toContain("<ol");
    expect((out.match(/<li/g) ?? []).length).toBe(2);
  });

  it("renders a horizontal rule for ---", () => {
    expect(html("above\n\n---\n\nbelow")).toContain("<hr");
  });

  it("renders plain paragraphs", () => {
    const out = html("Just a sentence.\n\nAnother one.");
    expect((out.match(/<p/g) ?? []).length).toBe(2);
    expect(out).toContain("Just a sentence.");
    expect(out).toContain("Another one.");
  });
});

describe("Markdown — GitHub-style tables (the claim inventory)", () => {
  const table = [
    "| ID | Claim | Status |",
    "| --- | --- | --- |",
    "| C001 | Babolat costs $250 | VERIFIED |",
    "| C002 | Wilson founded 1914 | UNVERIFIED |",
  ].join("\n");

  it("renders a <table> with header cells", () => {
    const out = html(table);
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out).toContain("ID");
    expect(out).toContain("Status");
  });

  it("renders one body row per data line with the cell contents", () => {
    const out = html(table);
    expect((out.match(/<tr/g) ?? []).length).toBe(3); // 1 header + 2 body
    expect(out).toContain("C001");
    expect(out).toContain("VERIFIED");
    expect(out).toContain("C002");
    expect(out).toContain("UNVERIFIED");
  });

  it("does NOT treat a lone pipe line (no separator) as a table", () => {
    const out = html("a | b but not a table");
    expect(out).not.toContain("<table");
    expect(out).toContain("a | b but not a table");
  });

  it("renders inline markdown inside table cells", () => {
    const out = html(
      [
        "| Claim | Evidence |",
        "| --- | --- |",
        "| **bold claim** | [src](https://e.test) |",
      ].join("\n")
    );
    expect(out).toContain("<strong>bold claim</strong>");
    expect(out).toContain('href="https://e.test"');
  });
});

describe("Markdown — edge cases", () => {
  it("renders empty text without crashing", () => {
    expect(html("")).toBe("<div></div>");
  });

  it("normalizes CRLF line endings", () => {
    const out = html("# Title\r\n\r\n- item");
    expect(out).toContain("Title");
    expect(out).toContain("<li");
  });
});
