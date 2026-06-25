/**
 * Tests that the Script page reads the `?title=` query param (the Make-script
 * handoff from the Competitors tab). The page's effect calls the pure exported
 * `readTitleParam(searchParams)` helper; we exercise that helper against real
 * URLSearchParams (which satisfy the `{ get(name) }` shape the page passes from
 * Next's useSearchParams).
 */
import { describe, it, expect } from "vitest";
import { readTitleParam } from "@/app/script/page";

/** Builds a URLSearchParams from a query string (the page passes the same API). */
function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("readTitleParam — Make-script handoff", () => {
  it("returns the title when present", () => {
    expect(readTitleParam(params("title=5%20golf%20brands"))).toBe(
      "5 golf brands"
    );
  });

  it("returns '' when no title param is present", () => {
    expect(readTitleParam(params("foo=bar"))).toBe("");
  });

  it("returns '' for a blank / whitespace-only title", () => {
    expect(readTitleParam(params("title=%20%20"))).toBe("");
  });

  it("round-trips a title with special characters (the real outlier title)", () => {
    const original =
      "5 tennis brands robbing you blind (and 5 worth every penny)";
    // Simulate the Competitors tab's makeScript() encoding.
    const url = `title=${encodeURIComponent(original)}`;
    expect(readTitleParam(params(url))).toBe(original);
  });

  it("round-trips ampersands and equals signs", () => {
    const original = "Wilson & Babolat: which = better value?";
    const url = `title=${encodeURIComponent(original)}`;
    expect(readTitleParam(params(url))).toBe(original);
  });
});
