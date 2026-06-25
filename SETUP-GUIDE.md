# TennisTimez Script Studio — Setup Guide

A friendly, step-by-step guide to get the app running on your own computer.
**No coding knowledge needed.** Works on **Windows** and **Mac**.

You give it a video **title** → it researches real sources on the web → it writes a finished **~2,000-word script** in your style, with a hook and a closing call-to-action. There's also an optional **fact-check** pass that verifies the claims against sources.

---

## What you'll need (the short version)

1. **A computer** — Windows or Mac.
2. **About 15 minutes**, once, for the first-time setup.
3. **An Anthropic (Claude) API key** — this is the only paid part. It's what actually writes the scripts. Cost is roughly **under $1 per script**, and you stay in full control of spending. The guide below shows you exactly how to get one.

That's everything. There's nothing else to buy or install for this version.

---

## Quick map (so you know what's coming)

1. Install **Node.js** (the free engine that runs the app) — *once*.
2. Put the **project folder** on your computer.
3. **Double-click the Start file** for your system — it sets everything up and launches the app.
4. Get your **Claude API key** and paste it into **Settings**.
5. **Generate your first script.** 🎾

Don't worry about the technical bits — each step is spelled out below, and after setup you'll just double-click one file to use it.

---

## Part 1 — Install Node.js (one time)

Node.js is the free engine that runs the app. You only do this once.

### On Windows
1. Go to **https://nodejs.org**
2. Click the big **"LTS"** button to download the installer.
3. Open the downloaded file → click **Next → Next → Install** (keep all defaults) → **Finish**.

### On Mac
1. Go to **https://nodejs.org**
2. Click the **"LTS"** button to download the installer (a `.pkg` file).
3. Open it → click **Continue → Install** (keep the defaults). You may need your Mac password.

> 💡 That's the only thing you install by hand. The app itself sets up automatically in Part 3.

---

## Part 2 — Put the project folder on your computer

Vlad will share the project with you — either as a **GitHub link** (he'll invite you to a private repo; accept the invite, then click the green **"Code"** button → **"Download ZIP"**) or as a **ZIP file** sent directly.

Either way:

1. **Unzip it** (double-click on Mac; right-click → "Extract All" on Windows).
2. Move the unzipped folder somewhere easy, like your **Desktop**.
3. Open the folder — inside you'll see files including **`2 - Start (Windows).bat`** and **`2 - Start (Mac).command`**. Those are your launch buttons.

---

## Part 3 — Start the app (just double-click)

You don't need to type any commands. Use the file for your system.

### On Windows
1. Double-click **`2 - Start (Windows).bat`**.
2. **The first time**, it installs the app's parts automatically — this takes a few minutes and shows a lot of text. That's normal. (After the first time, it starts in seconds.)
3. A black window stays open — **that *is* the running app, leave it open.** A browser tab opens automatically at **http://localhost:3000**.

> ⚠️ If Windows shows **"Windows protected your PC"**, click **"More info" → "Run anyway"**. (This appears because the file came from the internet — it's safe; it just starts the app.)

### On Mac
1. **The first time only:** right-click (or Control-click) **`2 - Start (Mac).command`** → choose **Open** → in the warning, click **Open** again. (After this first time, you can just double-click it.)
2. It installs the app's parts automatically on first run (a few minutes, lots of text — normal).
3. A Terminal window stays open — **that *is* the running app, leave it open.** A browser tab opens automatically at **http://localhost:3000**.

> ⚠️ If double-clicking does nothing on Mac, the file may need to be marked runnable once. Open the **Terminal** app, type `cd ` (with a space), drag the project folder onto the window, press Enter, then paste this and press Enter:
> ```
> chmod +x *.command
> ```
> Now the double-click will work.

When the browser opens, you should see **"TennisTimez Studio"**. 🎉

> 💡 **Advanced (optional):** if you'd rather use a terminal, you can instead run `npm install` once, then `npm run dev`, in the project folder. The launch files just do this for you.

---

## Part 4 — Get your Claude (Anthropic) API key

This key is what powers the writing. You do this once.

1. Go to **https://console.anthropic.com** and **sign up** (or log in).
2. **Add some credit:** open **Settings → Billing**, add a payment card, and add a small starting balance (e.g. **$5–$10**). Each script costs roughly **well under $1**, so a little lasts a long time.
3. **Create the key:** open the **API Keys** section → **"Create Key"** → name it (e.g. **`TennisTimez`**) → create.
4. **Copy the key immediately.** It starts with `sk-ant-...` and is shown **only once** — copy it now and keep it somewhere safe.

> 🔒 This key is like a password to your Claude credit. Don't share it publicly. In this app it's stored **only on your own computer**.

---

## Part 5 — Connect your key in the app

1. In the app (the **http://localhost:3000** page), click the **⚙ Settings** tab at the top.
2. **Paste your key** into the "Anthropic API key" box.
3. Click **Save**. You should see **"Connected ✓"**.

That's it — you won't need to do this again.

---

## Part 6 — Generate your first script 🎾

1. Click the **Script** tab.
2. Type a video **title**, for example:
   > `5 Tennis Brands Robbing You Blind (And 5 Worth Every Penny)`
3. Click **Generate script**.
4. The app will:
   - **Research** real sources on the web (this takes a few minutes — it's genuinely reading the internet).
   - **Write** the script, which appears live on screen, with a hook and a closing call-to-action.
5. Use the **Copy** button to grab the finished script. You can also expand **"Research & outline"** to see the sources it used.

**Optional — Fact-check:** after a script is generated, the **Fact-check** button runs a verification pass that checks the facts against sources and proposes fixes. You approve each step.

---

## Using it again, any other day

No re-setup needed. Each time you want to use it:

- **Windows:** double-click **`2 - Start (Windows).bat`**.
- **Mac:** double-click **`2 - Start (Mac).command`**.

Then use the browser tab that opens. Your key is already saved, so you go straight to writing.

**To stop the app:** close the black/Terminal window (or click it and press **Ctrl + C**).

---

## What the files do (in case you're curious)

| File | What it's for |
|---|---|
| **`2 - Start (Windows).bat`** / **`2 - Start (Mac).command`** | The everyday launch button — sets up on first run, then starts the app. This is the one you use. |
| **`1 - Install (Windows).bat`** / **`1 - Install (Mac).command`** | Optional — only needed if you want to (re)install the app's parts on their own, e.g. after Vlad sends an update. |
| **`SETUP-GUIDE.md`** | This guide. |

---

## What it costs

The **only** cost is your Claude API usage — roughly **under $1 per script** (a little for the web research, a little for the writing). You can see and cap your spending anytime in the Anthropic console under **Billing**. Nothing else in the app costs money.

---

## Troubleshooting (common little hiccups)

| What you see | What to do |
|---|---|
| **"Windows protected your PC"** (Windows) | Click **"More info" → "Run anyway"**. It's safe — just starts the app. |
| Double-click does nothing (Mac) | Right-click the file → **Open** → **Open**. If still nothing, run `chmod +x *.command` once (see Part 3). |
| `Node.js is not installed` message | Install Node.js (Part 1), then run the Start file again. |
| The page won't open at localhost:3000 | Make sure the black/Terminal window from the Start file is still open. |
| It opened on **localhost:3001** (or another number) | That's fine — 3000 was busy. Just use the address shown in the window. |
| **"ANTHROPIC_API_KEY is not set"** on the page | Add your key in the **Settings** tab (Part 5). |
| An error mentioning **credit / billing / quota** | Add credit in the Anthropic console (Part 4, step 2). |
| Generating "takes forever" | A few minutes is normal — it's doing live web research for every script. |

When in doubt, send Vlad a screenshot of the window or the page — that's the fastest way to get unstuck.

---

## What's coming next (not in this version yet)

This first version is the **Script** tool. Two more tabs are planned:

- **Competitors / Outliers** — automatically scans competitor channels every couple of days to surface trending topic ideas you can turn into scripts with one click.
- **My Analytics** — reads your own channel's retention to help pick topics.

The Competitors tab will need a second (free) **YouTube Data API key** — we'll add a short step here for that when it's ready.

---

Enjoy, and tell Vlad what you think of the scripts — the voice and structure can be tuned to your taste. 🎾
