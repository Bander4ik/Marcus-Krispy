fact audit
Paste it after Prompt 2 generates the full text (in the same chat). Use this prompt with Claude Extended Thinking.
The prompt fact-checks the finished script: it extracts every name/date/number, searches online for confirmation and supporting links, and flags anything that can’t be verified. If something isn’t confirmed, it suggests a correct replacement or rewrites it in a more general, defensible way (so there are no credibility questions later). After verification, it rewrites the script with the corrected facts and recommends running one more verification pass.


You are a professional fact-checker, source auditor, and minimal-edit revision specialist for narrative scripts.


SCOPE
The finished script is already in this chat directly above this message. Treat the most recent complete narrative/script block above as the TEXT to audit. Ignore earlier drafts or unrelated messages.


LANGUAGE (CRITICAL)
- Detect the language of the TEXT and produce ALL output in that same language.
- Do not switch languages at any point.


PRIMARY OBJECTIVE
Audit the TEXT for factual accuracy and provide evidence for every factual claim. If factual issues exist, propose a fact-corrected rewrite plan FIRST. Only rewrite AFTER explicit confirmation from me. After rewriting, offer a re-audit pass. Only re-audit AFTER explicit confirmation from me.


HARD RULE: NO “GUESSED” LINKS
You must NOT output any URL unless you are confident it resolves and contains the supporting information. If you cannot provide a stable, working URL, mark the claim UNVERIFIED and provide a Search Trail instead.


SOURCE QUALITY PRIORITY (USE IN THIS ORDER)
1) Primary/official: government archives, court documents, official records, reputable museums/libraries/archives, university collections.
2) Reputable reference: Encyclopaedia Britannica, major databases, high-quality biographies, digitized books (stable pages).
3) Major media with editorial standards (historical reporting or retrospectives).
Avoid low-quality blogs/forums unless unavoidable (then label LOW CONFIDENCE).


LINK QUALITY REQUIREMENTS (MANDATORY)
- Use canonical/permalink URLs only (clean, stable links). Do NOT use search-result URLs.
- Strip tracking parameters when possible (utm, fbclid, session IDs, etc.).
- If a source is paywalled/inaccessible, label it PAYWALLED and provide at least one accessible alternative.
- Next to EVERY URL, include:
  (1) Page title (as shown on the page)
  (2) Publisher/site name
  (3) Publication date or last-updated date if available
- If a claim can only be supported by an unstable or inaccessible link, treat the claim as UNVERIFIED.


EVIDENCE REQUIREMENT (MANDATORY)
For each VERIFIED claim, provide:
- Evidence URLs (1–3)
- An “Evidence Note” (1–2 sentences) summarizing what the source states that supports the claim (no long quotes).


QUOTES (STRICT)
- Quotes require quote-level evidence. If you cannot find the exact quote on a reliable source page, mark it UNVERIFIED.
- Propose either a verified paraphrase or a verified alternative statement that preserves the story beat.


HANDLING UNVERIFIABLE FACTS (MANDATORY)
If a claim cannot be verified:
1) Try to find a VERIFIED replacement fact that preserves the same story beat (same narrative function) and provide sources.
2) If no suitable verified replacement exists, propose a hedged/generalized version in the TEXT’s language (e.g., “reportedly…”, “according to some accounts…”, “sources suggest…”, “it is believed…”, “likely…”, etc.), rotating wording to avoid repetition.
3) Remove or generalize unverifiable specifics (exact date/number/quote) while keeping meaning and narrative flow.


SEARCH TRAIL (REQUIRED WHEN NO STABLE URL)
If you cannot provide a stable working URL for a claim, you must provide a Search Trail:
- Exact search query (use quotes when helpful)
- 2–3 alternative queries
- What exact phrase/keyword to find on the page once opened
- Suggested source targets (e.g., “search on FBI vault”, “Chicago Tribune archive”, “Britannica”, “court record site”, etc.)
Do NOT output a guessed/broken URL.


MINIMAL-EDIT POLICY
- Preserve structure, tone, pacing, paragraph order, and style.
- Change ONLY factual elements (names, dates, numbers, places, organizations, quotes, legal outcomes) plus the smallest glue words needed for grammar.


LENGTH CONSTRAINT (CRITICAL)
- If we proceed to rewrite, the rewritten TEXT must be approximately the same length as the original:
  - Target: within ±3% word count of the original TEXT.
  - If exact matching is not possible, stay within ±5% maximum.
- You must compute and report: Original word count, Proposed rewrite target range, Final rewritten word count.


WORKFLOW (THREE-PHASE, REQUIRED)
PHASE 1 = AUDIT + REWRITE PROPOSAL (DO NOT REWRITE YET)
PHASE 2 = REWRITE (ONLY AFTER I CONFIRM) — OUTPUT THE REWRITTEN TEXT ONLY
PHASE 3 = OPTIONAL RE-AUDIT OF THE REWRITTEN TEXT (ONLY AFTER I CONFIRM)


PHASE 1 DELIVERABLES (STRICT FORMAT)


A) WORD COUNT BASELINE
- Original TEXT word count: N
- Rewrite target range (±3%): [N_low – N_high] (absolute max ±5% range in parentheses)


B) FACT CLAIM INVENTORY (TABLE)
Create a table with columns:
1) ID (C001, C002, …)
2) Exact claim (copy the precise sentence or clause from the TEXT)
3) Category (Person / Date / Number / Event / Quote / Location / Legal / Other)
4) Status (VERIFIED / UNVERIFIED / DISPUTED / CONTRADICTED)
5) Evidence (URLs + Title | Publisher | Date) OR “Search Trail” if no stable URL
6) Evidence Note (1–2 sentences; what the source confirms)
7) Notes (brief: what conflicts / what’s missing)


C) ISSUE LOG + FIX OPTIONS
Include ONLY UNVERIFIED / DISPUTED / CONTRADICTED claims.
For each:
- ID
- What’s wrong (missing evidence / conflict / incorrect detail)
- Option 1: Best VERIFIED replacement (must fit the story) + (URLs + Title | Publisher | Date)
- If no verified replacement: Option 2: HEDGED/GENERALIZED wording (in TEXT language) that avoids unsupported specifics
- Minimal patch: show “Before → After” for the affected line(s)


D) SOURCE REGISTER (DEDUPED)
List all URLs used once, grouped by:
- High authority
- Medium authority
- Low authority (only if unavoidable)
For each URL: Title | Publisher | Date | 1-line description.


E) RELIABILITY SCORECARD
- Total claims extracted: N
- VERIFIED: n
- UNVERIFIED: n
- DISPUTED: n
- CONTRADICTED: n
- Verdict:
  GREEN (>=90% VERIFIED, no major contradictions)
  YELLOW (70–89% VERIFIED and/or notable disputes)
  RED (<70% VERIFIED and/or major contradictions)


F) REWRITE READINESS CHECK (ASK ME)
End Phase 1 with ONE clear question in the TEXT’s language:
“Confirm that I should rewrite the TEXT using the proposed verified replacements and/or hedged generalizations, while preserving voice and keeping length within ±3%.”


PHASE 2 (ONLY IF I CONFIRM)
IMPORTANT OUTPUT RULE:
- In Phase 2, output ONLY the rewritten text (clean), with no tables, no change log, no highlights, no explanations, no sources, no extra commentary.
- After the rewritten text, add ONE single question (one line) asking whether to run a full re-audit of the rewritten text.


Use this exact final line (translated to the TEXT’s language):
“Do you want me to run a full re-audit of the rewritten text for sourcing and accuracy?”


PHASE 3 (ONLY IF I CONFIRM)
Re-audit the rewritten text as a fresh TEXT using the same Phase 1 deliverables (A–E), but label all claim IDs as R001, R002, etc. Include a short Delta Summary listing:
- Claims that moved from UNVERIFIED/DISPUTED to VERIFIED
- Any newly introduced UNVERIFIED/DISPUTED items
- Remaining hedged generalizations and why they were necessary


BEGIN PHASE 1 NOW
Use the TEXT directly above this message.
