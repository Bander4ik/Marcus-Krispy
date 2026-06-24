# TennisTimez Script Studio — Setup Guide

A friendly, step-by-step guide to get the app running on your own computer.
**No coding knowledge needed.** Works on **Windows** and **Mac**.

You give it a video **title** → it researches real sources on the web → it writes a finished **~2,000-word script** in your style. Optionally, it can fact-check the script too.

---

## What you'll need (the short version)

1. **A computer** — Windows or Mac.
2. **About 20 minutes**, once, for the first-time setup.
3. **An Anthropic (Claude) API key** — this is the only paid part. It's what actually writes the scripts. Cost is roughly **under $1 per script** (you stay in full control of spending). The guide below shows you exactly how to get one.

That's everything. There's nothing else to buy or install for this version.

---

## Quick map of the setup (so you know what's coming)

1. Install **Node.js** (the engine that runs the app) — *once*.
2. Get the **project folder** onto your computer.
3. Open a **terminal** inside that folder.
4. Run **`npm install`** (downloads the app's parts) — *once*.
5. Run **`npm run dev`** (starts the app).
6. Get your **Claude API key**.
7. Paste the key into the app's **Settings**.
8. **Generate your first script.** 🎾

Don't worry if some words are unfamiliar — each step is spelled out below.

---

## Part 1 — Install Node.js (one time)

Node.js is the free engine that runs the app.

### On Windows
1. Go to **https://nodejs.org**
2. Click the big button that says **"LTS"** (Recommended) to download the installer.
3. Open the downloaded file and click **Next → Next → Install** (keep all the default options) → **Finish**.
4. **Check it worked:** click Start, type **`cmd`**, press Enter to open a black "Command Prompt" window. Type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v20.18.0` or `v22.x.x`. (Any number 20 or higher is good.)

### On Mac
1. Go to **https://nodejs.org**
2. Click the **"LTS"** button to download the installer (a `.pkg` file).
3. Open it and click through **Continue → Install** (keep the defaults). You may need your Mac password.
4. **Check it worked:** press **Cmd + Space**, type **`Terminal`**, press Enter to open Terminal. Type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v20.18.0` or `v22.x.x`. (Any number 20 or higher is good.)

> 💡 If `node -v` says "not recognized" or "command not found", close the terminal, reopen it, and try again. If it still fails, re-run the Node installer.

---

## Part 2 — Get the project folder onto your computer

Vlad will share the project with you in one of two ways:

- **As a GitHub link** — he'll invite you to a private repository. Accept the invite (you'll get an email or a GitHub notification), then open the link, click the green **"Code"** button, and choose **"Download ZIP"**.
- **As a ZIP file** — he sends it to you directly.

Either way, you'll end up with a **ZIP file**. Now:

1. **Unzip it** (double-click on Mac; right-click → "Extract All" on Windows).
2. Move the unzipped folder somewhere easy to find — for example, your **Desktop**.
3. Remember where it is. The folder contains files like `package.json`, `README.md`, and an `app` folder inside it.

---

## Part 3 — Open a terminal *inside* the project folder

This is the step people find trickiest, so here's the easy way for each system.

### On Windows
1. Open the project folder in **File Explorer** (so you can see `package.json` inside it).
2. Click once in the **address bar** at the top (where the folder path is shown).
3. Type **`cmd`** and press **Enter**.
4. A black window opens — and it's **already inside your folder**. 

### On Mac
1. Open **Terminal** (Cmd + Space → type `Terminal` → Enter).
2. Type **`cd`** followed by a **single space** (don't press Enter yet):
   ```
   cd 
   ```
3. Now **drag the project folder** from Finder and **drop it onto the Terminal window**. It will paste the folder's location automatically.
4. Press **Enter**. You're now "inside" the folder.

> 💡 You can confirm you're in the right place: type `ls` (Mac) or `dir` (Windows) and press Enter — you should see `package.json` in the list.

---

## Part 4 — Install the app's parts (one time)

In that same terminal window, type this and press **Enter**:
```
npm install
```
This downloads everything the app needs. It takes **a few minutes** and prints a lot of text — that's completely normal. Just wait until it finishes and you get a fresh, empty line back.

> 💡 You only ever do this **once** per computer (and again only if Vlad sends a major update).

---

## Part 5 — Start the app

In the same terminal, type this and press **Enter**:
```
npm run dev
```
Wait a few seconds until you see a line that mentions **`http://localhost:3000`** (and the word "Ready").

**Leave this terminal window open** — it *is* the running app. If you close it, the app stops.

Now open your web browser (Chrome, Safari, Edge…) and go to:

### 👉 http://localhost:3000

You should see **"TennisTimez Studio"**. 🎉

---

## Part 6 — Get your Claude (Anthropic) API key

This key is what powers the writing. You do this once.

1. Go to **https://console.anthropic.com** and **sign up** (or log in).
2. **Add some credit:** open **Settings → Billing**, add a payment card, and add a small starting balance (e.g. **$5–$10**). Each script costs roughly **well under $1**, so a little goes a long way.
3. **Create the key:** open the **API Keys** section → click **"Create Key"** → give it a name like **`TennisTimez`** → click create.
4. **Copy the key immediately.** It starts with `sk-ant-...` and is shown **only once** — copy it now and keep it somewhere safe.

> 🔒 This key is like a password to your Claude credit. Don't share it publicly. In this app it's stored **only on your own computer**.

---

## Part 7 — Connect your key in the app

1. In the app (the **http://localhost:3000** page), click the **⚙ Settings** tab at the top.
2. **Paste your key** into the "Anthropic API key" box.
3. Click **Save**.
4. You should now see **"Connected ✓"**. Done — you won't need to do this again.

---

## Part 8 — Generate your first script 🎾

1. Click the **Script** tab.
2. Type a video **title** in the box, for example:
   > `5 Tennis Brands Robbing You Blind (And 5 Worth Every Penny)`
3. Click **Generate script**.
4. The app will:
   - **Research** real sources on the web (this takes a few minutes — it's genuinely reading the internet).
   - **Write** the script, which appears live on the screen.
5. Use the **Copy** button to grab the finished script.

**Optional — Fact-check:** after a script is generated, the **Fact-check** button runs a verification pass that checks the facts against sources and proposes fixes. (You approve each step.)

---

## Using it again, any other day

You **don't** repeat the whole setup. Each time you want to use it:

1. Open a terminal inside the project folder (**Part 3**).
2. Type `npm run dev` and press Enter.
3. Open **http://localhost:3000** in your browser.

Your key is already saved, so you go straight to writing.

**To stop the app:** click the terminal window and press **Ctrl + C** (on both Windows and Mac), or just close the window.

---

## What it costs

The **only** cost is your Claude API usage — roughly **under $1 per script** (a bit for the web research, a bit for the writing). You can see and cap your spending anytime in the Anthropic console under **Billing**. Nothing else in the app costs money.

---

## Troubleshooting (common little hiccups)

| What you see | What to do |
|---|---|
| `node is not recognized` / `command not found` | Close and reopen the terminal. If it persists, re-install Node.js (Part 1). |
| The page won't open at localhost:3000 | Make sure the `npm run dev` terminal is still open and shows "Ready". |
| It opened on **localhost:3001** (or another number) | That's fine — port 3000 was busy. Just use the address the terminal shows. |
| **"ANTHROPIC_API_KEY is not set"** on the page | Add your key in the **Settings** tab (Part 7). |
| An error mentioning **credit / billing / quota** | Add credit in the Anthropic console (Part 6, step 2). |
| Generating "takes forever" | A few minutes is normal — it's doing live web research for every script. |
| `npm install` showed warnings | Warnings (yellow) are usually fine. Only a hard "error" that stops it is a problem — send Vlad a screenshot. |

When in doubt, send Vlad a screenshot of the terminal or the page — that's the fastest way to get unstuck.

---

## What's coming later (not in this version yet)

This first version is the **Script** tool. Two more tabs are planned:

- **Competitors / Outliers** — automatically scans competitor channels every few days to surface trending topic ideas.
- **My Analytics** — reads your own channel's retention to help pick topics.

Those will need a one-time **YouTube / Google** connection, which we'll guide you through when they're ready.

---

Enjoy, and tell Vlad what you think of the scripts — the voice and structure can be tuned to your taste. 🎾
