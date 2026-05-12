# Tuition Lens — Deployment Guide

A college cost scenario-planning app for high-income families.

## Live Demo

Once deployed, it'll be at: **https://don23fan-svg.github.io/tuition-lens**

(Replace `don23fan-svg` with your GitHub username if different.)

---

## Deploying to GitHub Pages (no coding required)

### Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Repository name: `tuition-lens` (exactly this — must match the project config)
3. Visibility: **Public** (required for free GitHub Pages)
4. Don't check any of the initialization boxes (no README, no .gitignore)
5. Click **Create repository**

### Step 2 — Upload the project files

1. On your new empty repo page, click the **"uploading an existing file"** link
2. Drag the entire contents of the unzipped `tuition-lens` folder into the upload area
   - **Important:** Drag the *contents* of the folder, not the folder itself. You should see files like `package.json`, `index.html`, `vite.config.js`, plus `src/`, `public/`, and `.github/` folders at the root of your repo.
3. Scroll down and type a commit message like "Initial upload"
4. Click **Commit changes**

### Step 3 — Enable GitHub Pages

1. In your repo, click **Settings** (top nav)
2. In the left sidebar, click **Pages**
3. Under "Build and deployment":
   - **Source:** GitHub Actions
4. That's it — no other settings needed.

### Step 4 — Wait for the deploy

1. Click the **Actions** tab in your repo
2. You should see a workflow running called "Deploy to GitHub Pages"
3. It takes about 2 minutes to complete (you'll see a green checkmark when done)
4. Once green, your site is live at `https://YOUR-USERNAME.github.io/tuition-lens`

### Step 5 — Share with family

Just send them the URL. Each person who opens it will see the default scenarios but can edit them — their changes save locally in their own browser only (so Amy's edits won't overwrite yours).

---

## Making future changes

When you want to update the app:

**Option A: Use Claude again**
1. Ask Claude to make the changes
2. Download the updated `CollegePlanner.jsx` file
3. In your GitHub repo, go to `src/CollegePlanner.jsx`
4. Click the pencil (edit) icon
5. Replace the content with the new file
6. Commit
7. GitHub Actions will automatically rebuild and redeploy within ~2 minutes

**Option B: Edit directly on GitHub**
Most settings are at the top of `src/CollegePlanner.jsx` — you can edit numbers like default 529 balances, the overlays object for new schools, etc., directly on GitHub's web UI.

---

## Project structure (what each file does)

- `src/CollegePlanner.jsx` — the entire app (1,100+ lines of React)
- `public/schools_data.json` — IPEDS data for 1,569 colleges
- `src/main.jsx` — entry point that bootstraps the app
- `src/index.css` — Tailwind CSS setup
- `index.html` — the HTML shell
- `vite.config.js` — build config (base path is `/tuition-lens/`)
- `tailwind.config.js` — Tailwind setup
- `package.json` — npm dependencies
- `.github/workflows/deploy.yml` — auto-deploy on every push to main

---

## Troubleshooting

**The site shows but the page is blank / 404:**
- Check that the repo is named exactly `tuition-lens`
- If you named it something else, edit `vite.config.js` and change `base: '/tuition-lens/'` to match your repo name

**The schools data doesn't load:**
- Confirm `public/schools_data.json` is in the repo
- The browser console will show fetch errors if the path is wrong

**The Actions workflow fails:**
- Click into the failed workflow run to see what went wrong
- Most common: typos in `package.json` from manual edits

---

## Limitations to know about

- **Privacy:** All data lives in each user's browser (localStorage). No server, no database, nothing sent anywhere.
- **No login:** Anyone with the URL can use it. If you want to gate access, you'd need to add authentication (not currently included).
- **Mobile works** but the school browse table is best viewed on desktop.
