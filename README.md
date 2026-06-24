# Marcus Krispy — TennisTimez Studio

Phase-1 scaffold for @TennisTimez (client: Marcus Krispy). A lean Next.js
(App Router, TypeScript) app. Three tabs; only **Script** is live.

## Tabs

| Tab | Route | Status |
|---|---|---|
| **Script** | `/script` | **Live** — title/idea in, full voiceover script out (streamed). |
| Competitors / Outliers | `/competitors` | Seam only — YouTube Data API v3 (Phase 2). |
| My Analytics | `/analytics` | Seam only — YouTube Analytics API + Google OAuth (Phase 3). |

## How it works (Script tab)

`app/script/page.tsx` → `POST /api/script` → `getScriptEngine()`
(`SingleShotEngine`) → `pickModel("script-writing")` → `streamAnthropic` with
**`claude-sonnet-4-6`** + adaptive thinking, streamed back token-by-token.

- **Model is swappable** without code changes: set `SCRIPT_MODEL` in
  `.env.local` (e.g. `claude-opus-4-8`). Provider stays Anthropic.
- **Engine is swappable**: `SCRIPT_ENGINE=single-shot` (default) or `pipeline`
  (Phase-2 stub). The pipeline seam exists but throws until built.
- **Cheap mechanical steps** (future title cleanup, outlines, tags) run on
  Gemini 2.5 Flash via `lib/models/gemini.ts` — wired but unused in Phase-1.

The TennisTimez prompt is a clearly-marked **placeholder** in
`channels/tennistimez/`. When Marcus delivers the real prompt, replace
`system_prompt.md` — no code changes needed.

## Run locally (Mac)

```sh
cd "/Users/cupak/CascadeProjects/Marcus Krispy"
cp .env.local.example .env.local        # then fill ANTHROPIC_API_KEY
npm install
npm run dev                             # http://localhost:3000 → /script
```

Production-style: `npm run build && npm run start`. Node 22+ (this machine
runs Node 26 — fine). No Python required.

**Do NOT run `npm audit fix --force`** — it downgrades Next and breaks the app.

## Env vars

Only `ANTHROPIC_API_KEY` is required for Phase-1. See `.env.local.example` for
the rest (all optional or seam-only). Keys are read from env — never hardcoded.
