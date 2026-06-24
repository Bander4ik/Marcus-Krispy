"use client";

/**
 * Markdown — a tiny, dependency-free renderer for the markdown the fact audit
 * emits (headings, **bold**, GitHub-style tables, bullet/numbered lists, links,
 * horizontal rules, paragraphs). It is intentionally small: it covers what
 * channels/tennistimez/prompts/fact_audit.md produces, not full CommonMark.
 *
 * Kept separate from page.tsx so the Script page stays focused on flow/state.
 * Pure given its `text` prop (no side effects), so it streams safely — re-render
 * on every token is fine.
 */
import React from "react";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

/** Renders inline markdown (links + bold) inside one line as React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // First split on links, then apply bold within the non-link segments.
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderBold(text.slice(lastIndex, match.index), `${keyPrefix}-t${i}`)
      );
    }
    nodes.push(
      <a
        key={`${keyPrefix}-a${i}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)", wordBreak: "break-all" }}
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
    i += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(...renderBold(text.slice(lastIndex), `${keyPrefix}-t${i}`));
  }
  return nodes;
}

/** Splits a plain (no-link) segment into bold / normal runs. */
function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(<strong key={`${keyPrefix}-b${i}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
    i += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** A markdown table row's cells, split on unescaped pipes. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** True for a table separator row like `| --- | :--: |`. */
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

const TH_TD: React.CSSProperties = {
  border: "1px solid var(--border)",
  padding: "6px 8px",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: 12.5,
  lineHeight: 1.45,
};

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    const content = para.join(" ");
    blocks.push(
      <p
        key={`p${key++}`}
        style={{ margin: "0 0 10px", lineHeight: 1.55, fontSize: 13.5 }}
      >
        {renderInline(content, `p${key}`)}
      </p>
    );
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l${key++}`}
        style={{ margin: "0 0 10px", paddingLeft: 20, lineHeight: 1.5 }}
      >
        {items.map((it, idx) => (
          <li key={idx} style={{ marginBottom: 4, fontSize: 13.5 }}>
            {renderInline(it, `l${key}-${idx}`)}
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Table: a `|`-row followed by a separator row.
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      flushPara();
      flushList();
      const header = splitRow(trimmed);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length; j += 1) {
        const r = lines[j].trim();
        if (!r.includes("|")) break;
        rows.push(splitRow(r));
      }
      blocks.push(
        <div key={`tbl${key++}`} style={{ overflowX: "auto", margin: "0 0 12px" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: 480,
            }}
          >
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    style={{
                      ...TH_TD,
                      background: "var(--background)",
                      fontWeight: 600,
                    }}
                  >
                    {renderInline(h, `th${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {header.map((_, ci) => (
                    <td key={ci} style={TH_TD}>
                      {renderInline(r[ci] ?? "", `td${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push(
        <hr
          key={`hr${key++}`}
          style={{
            border: "none",
            borderTop: "1px solid var(--border)",
            margin: "12px 0",
          }}
        />
      );
      continue;
    }

    // Headings.
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const size = [18, 17, 15.5, 14.5, 14, 13.5][level - 1] ?? 14;
      blocks.push(
        <div
          key={`h${key++}`}
          style={{
            fontSize: size,
            fontWeight: 700,
            margin: "14px 0 8px",
            color: "var(--foreground)",
          }}
        >
          {renderInline(heading[2], `h${key}`)}
        </div>
      );
      continue;
    }

    // Bullet list item.
    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushPara();
      if (list && !list.ordered) list.items.push(bullet[1]);
      else {
        flushList();
        list = { ordered: false, items: [bullet[1]] };
      }
      continue;
    }

    // Numbered list item.
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flushPara();
      if (list && list.ordered) list.items.push(numbered[1]);
      else {
        flushList();
        list = { ordered: true, items: [numbered[1]] };
      }
      continue;
    }

    // Blank line ends paragraph / list.
    if (trimmed === "") {
      flushPara();
      flushList();
      continue;
    }

    // Otherwise: paragraph text.
    flushList();
    para.push(trimmed);
  }

  flushPara();
  flushList();

  return <div>{blocks}</div>;
}
