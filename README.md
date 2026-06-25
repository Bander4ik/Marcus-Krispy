# TennisTimez Script Studio

A local web app for the **@TennisTimez** channel (client: Marcus Krispy). Give it a
video title and it researches real sources on the web and writes a full
**~2,000-word script** in your style (hook + closing CTA); it also surfaces
trending **topic ideas** by scanning competitor channels for over-performers.

> **👉 Non-technical setup & usage: see [SETUP-GUIDE.md](SETUP-GUIDE.md)** —
> step-by-step for Windows & Mac, you just double-click a launcher.

## Features

| Tab | What it does |
|---|---|
| **Script** | Title → live web research → ~2,000-word script (hook + CTA), streamed. Optional 3-phase **fact-check**. |
| **Competitors / Outliers** | Scans competitor channels, ranks the videos that beat that channel's usual views, one-click **"Make script"** into the Script tab. Auto-scans every ~2 days. |
| My Analytics | Coming soon (your channel's retention). |

## Integrations (keys)

Entered in the in-app **Settings** tab (or via `.env.local`). See SETUP-GUIDE.md for where to get each.

- **Anthropic (Claude) API key** — required for writing scripts (~under $1/script).
- **YouTube Data API key** — free, required for the Competitors tab.

## Run (developers)

From the project folder:

```sh
npm install
npm run dev      # http://localhost:3000
```

Production: `npm run build && npm run start`. Requires **Node 20+**. No Python.

> **Do NOT run `npm audit fix --force`** — it downgrades Next and breaks the app.

## Tech

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Anthropic SDK
(`claude-sonnet-4-6`, server-side web search) · YouTube Data API v3. Keys are read
from env or `~/.marcus-krispy/secrets.json` (0600) — never hardcoded. Engine logic
under `lib/`, prompts under `channels/tennistimez/`. **268 tests** (`npm test`).
For deeper architecture/decision notes see `STATUS.md`.
