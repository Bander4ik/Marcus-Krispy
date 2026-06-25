# TennisTimez Script Studio — Setup & User Guide

A friendly, step-by-step guide to install and use the app on your own computer.
**No coding knowledge needed.** Works on **Windows** and **Mac**.

The app does two things:

1. **Script** — you give it a video **title**, it researches real sources on the web, and writes a finished **~2,000-word script** in your style (hook + closing call-to-action). It can also **fact-check** the script.
2. **Competitors / Outliers** — it scans competitor YouTube channels every couple of days and shows you the videos that **massively over-performed** (great topic ideas). One click turns any of them into a script.

> 📄 **Want to see what it produces first?** Open **`_sample_output_tennis.md`** in the project folder — it's a full example script the app generated.

---

## The integrations you'll need (and where to get them)

The app connects to two services. Here's the short version — full step-by-step is in Parts 4 and 5.

| Integration | Needed for | Cost | Where to get it |
|---|---|---|---|
| **Anthropic (Claude) API key** | Writing scripts (the **Script** tab) | Paid — roughly **under $1 per script** | https://console.anthropic.com |
| **YouTube Data API key** | Finding topic ideas (the **Competitors** tab) | **Free** | https://console.cloud.google.com |

> You can start with **just the Anthropic key** (to write scripts) and add the YouTube key later (for the topic finder). The app works fine with one, both, or — for setup — neither.

Plus one free thing to install on your computer: **Node.js** (the engine that runs the app — Part 1).

---

## Quick map

1. Install **Node.js** — *once*.
2. Put the **project folder** on your computer.
3. **Double-click the Start file** for your system.
4. Get your **Anthropic key** → paste it in **Settings**.
5. *(Optional)* Get your **YouTube key** → paste it in **Settings**.
6. **Write scripts** and **find topic ideas.** 🎾

---

## Part 1 — Install Node.js (one time)

Node.js is the free engine that runs the app. You only do this once.

- **Windows:** go to **https://nodejs.org** → click the big **"LTS"** button → open the downloaded file → **Next → Next → Install → Finish** (keep all defaults).
- **Mac:** go to **https://nodejs.org** → click **"LTS"** → open the `.pkg` → **Continue → Install** (you may need your Mac password).

> 💡 That's the only thing you install by hand. The app itself sets up automatically in Part 3.

---

## Part 2 — Put the project folder on your computer

Vlad will share the project as a **GitHub link** (accept his invite, then **green "Code" button → "Download ZIP"**) or as a **ZIP file** directly.

1. **Unzip it** (double-click on Mac; right-click → "Extract All" on Windows).
2. Move the folder somewhere easy, like your **Desktop**.
3. Inside you'll see the launch files: **`2 - Start (Windows).bat`** and **`2 - Start (Mac).command`**.

---

## Part 3 — Start the app (just double-click)

No typing required. Use the file for your system.

### Windows
1. Double-click **`2 - Start (Windows).bat`**.
2. **First time:** it installs the app's parts automatically (a few minutes, lots of text — normal).
3. A black window stays open — **that *is* the app, leave it open.** A browser opens at **http://localhost:3000**.

> ⚠️ If **"Windows protected your PC"** appears → **"More info" → "Run anyway"**. It's safe; it just starts the app.

### Mac
1. **First time only:** right-click (Control-click) **`2 - Start (Mac).command`** → **Open** → in the warning, **Open** again. (After that, a normal double-click works.)
2. It installs the app's parts on first run (a few minutes — normal).
3. A Terminal window stays open — **leave it open.** A browser opens at **http://localhost:3000**.

> ⚠️ If double-clicking does nothing on Mac: open the **Terminal** app, type `cd ` (with a space), drag the project folder onto the window, press Enter, then paste `chmod +x *.command` and press Enter. Now it'll work.

You should see **"TennisTimez Studio"** in the browser. 🎉

> 💡 **Advanced (optional):** instead of the launch files you can run `npm install` once, then `npm run dev`, in a terminal.

---

## Part 4 — Get your Anthropic (Claude) key — for writing scripts

1. Go to **https://console.anthropic.com** → **sign up** / log in.
2. **Add credit:** **Settings → Billing** → add a card and a small balance (e.g. **$5–$10**). Each script is roughly **under $1**.
3. **Create the key:** **API Keys → "Create Key"** → name it (e.g. `TennisTimez`) → create.
4. **Copy it now** (starts with `sk-ant-...`; shown only once).

---

## Part 5 — Get your YouTube key — for the topic finder (free, optional)

Skip this if you only want to write scripts for now. You can add it anytime.

1. Go to **https://console.cloud.google.com** → sign in with a Google account.
2. **Create a project:** top bar → **"Select a project" → "New Project"** → give it any name → **Create** (then make sure it's selected).
3. **Turn on the YouTube service:** in the top search bar, type **"YouTube Data API v3"** → click the result → click **"Enable"**.
4. **Make the key:** left menu → **"APIs & Services" → "Credentials"** → **"Create Credentials" → "API key"** → **copy** the key that appears (starts with `AIza...`).

> 🔒 It reads **public** channel data only (no login to your channel), and it's **free** for this use. You can close any "restrict key" pop-up — not required.

---

## Part 6 — Connect your key(s) in the app

1. In the app, click the **⚙ Settings** tab.
2. Paste your **Anthropic key** in the first box → **Save** → it shows **"Connected ✓"**.
3. *(Optional)* Paste your **YouTube key** in the second box → **Save**.

Done — you won't need to do this again. Keys are stored **only on your own computer**.

---

## Part 7 — Write a script 🎾

1. Click the **Script** tab.
2. Type a **title**, e.g. `5 Tennis Brands Robbing You Blind (And 5 Worth Every Penny)`.
3. Click **Generate script**.
4. It **researches the web** (a few minutes — that's it reading real sources), then **writes the script** live on screen, with a hook and a closing call-to-action.
5. **Copy** the finished script. You can expand **"Research & outline"** to see the sources it used.

> ⏱️ A script takes roughly **8–10 minutes**, mostly the web research (that's what keeps it accurate). Kick it off and come back.

**Optional — Fact-check:** after a script is generated, the **Fact-check** button verifies the claims against sources and proposes fixes. You approve each step.

---

## Part 8 — Find topic ideas from competitors

1. Click the **Competitors** tab. (You need your **YouTube key** from Part 5 saved.)
2. It comes pre-loaded with a set of competitor channels (you can **add or remove** any — paste a `@handle` or a channel URL).
3. Click **Scan now** (it also auto-scans when you open the tab if it's been ~2 days). It takes a few seconds.
4. You'll get a list of **Outliers** — videos that beat their channel's usual views by a lot, with a badge like **`12× usual`**, ranked top to bottom.
5. See one you like? Click **"Make script →"** — it drops that title straight into the **Script** tab, ready to generate.

> 💡 That's the whole loop: the scanner finds a proven topic → one click writes you a script on it.

---

## Settings & options — what everything means

**In the app's ⚙ Settings tab:**

| Setting | What it is | Required? |
|---|---|---|
| **Anthropic API key** | Powers the script writing (Claude). | **Yes**, for the Script tab. Paid (~under $1/script). |
| **YouTube Data API key** | Powers the Competitors topic finder. | Only if you use the Competitors tab. **Free.** |

Both keys are stored **only on your computer** and shown masked (last 4 characters). Remove one anytime with its **Clear** button.

**On the Competitors tab:**

- **Channel list** — the competitor channels it scans. Add any with `@handle` or a channel URL; remove with the **×**. It comes pre-loaded with a starter set you can change freely.
- **Scan now / auto-scan** — it re-scans automatically when you open the tab if it's been about **2 days**; **"Scan now"** forces a fresh scan anytime.
- **"Outlier" / the `N× usual` badge** — a video that got far more views than that channel's *usual* (e.g. `8× usual` = eight times its normal). That's the signal a topic is hot. The list is ranked by that number, biggest first.

**Advanced (optional — you can completely ignore these):**

These live in the `.env.local` file and are just for tinkering — the app works perfectly without touching them.

- **`SCRIPT_MODEL`** — swap the writing model. Default is `claude-sonnet-4-6`. You could set `claude-opus-4-8` for a stronger (and pricier) writer.
- **`APP_PASSWORD`** — a login password. Only needed if you ever put the app online; not for normal use on your own computer.
- Anything else in `.env.local.example` is for future features or for developers.

---

## Using it again, any other day

- **Windows:** double-click **`2 - Start (Windows).bat`**.
- **Mac:** double-click **`2 - Start (Mac).command`**.

Then use the browser tab that opens. Your keys are already saved.
**To stop the app:** close the black/Terminal window (or press **Ctrl + C** in it).

---

## The files in the folder (in case you're curious)

| File | What it's for |
|---|---|
| **`2 - Start (Windows/Mac)`** | The everyday launch button — sets up on first run, then starts the app. **This is the one you use.** |
| **`1 - Install (Windows/Mac)`** | Optional — reinstall the app's parts on their own (e.g. after Vlad sends an update). |
| **`SETUP-GUIDE.md`** | This guide. |

---

## What it costs

- **Scripts:** your Anthropic usage — roughly **under $1 per script**. See/cap spending at console.anthropic.com → Billing.
- **Topic finder:** **free** (the YouTube key has generous free limits; scanning a dozen channels every couple of days uses a tiny fraction).

---

## Troubleshooting

| What you see | What to do |
|---|---|
| **"Windows protected your PC"** | **"More info" → "Run anyway"** — it's safe. |
| Double-click does nothing (Mac) | Right-click → **Open** → **Open**. If still nothing, run `chmod +x *.command` once (Part 3). |
| `Node.js is not installed` message | Install Node.js (Part 1), then run the Start file again. |
| Page won't open at localhost:3000 | Make sure the black/Terminal window from the Start file is still open. |
| It opened on **localhost:3001** | Fine — 3000 was busy; use the address shown in the window. |
| **"ANTHROPIC_API_KEY is not set"** | Add your Anthropic key in **Settings** (Part 6). |
| Competitors says a **YouTube key is needed** | Add your YouTube key in **Settings** (Part 5–6). |
| Error mentioning **credit / billing / quota** (scripts) | Add credit in the Anthropic console (Part 4). |
| A script "takes forever" | 8–10 minutes is normal — it's doing live web research. |

When in doubt, send Vlad a screenshot of the window or the page.

---

## What's coming next (not in this version yet)

- **My Analytics** — reads your own channel's retention to help pick topics. (Will need a one-time YouTube login, which we'll guide you through.)

Everything else — the **Script** writer and the **Competitors / Outliers** topic finder — is ready to use now.

Enjoy, and tell Vlad what you think of the scripts — the voice and structure can be tuned to your taste. 🎾
