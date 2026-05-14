# Tuition Lens — Deployment Guide

A college cost scenario-planning app for families.

## Live Demo

Once deployed, it'll be at: **https://don23fan-svg.github.io/tuition-lens**

(Replace `don23fan-svg` with your GitHub username if different.)

---

## Two deployment levels

**Level 1 — Anonymous only (5 minutes, no backend):**
Deploy as-is. Everyone can use the app; each person's data is saved in their own
browser. No accounts, no login. Good for sharing with a handful of people.

**Level 2 — With user accounts (adds ~15 min, free backend):**
Set up Supabase (see `SUPABASE_SETUP.md`). Users can still try the app anonymously,
but can also create an account to save scenarios that sync across their devices.
Each account's data is private and isolated.

You can start with Level 1 and add Level 2 later — they're independent.

---

## Level 1 — Deploy to GitHub Pages (no coding required)

### Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Repository name: `tuition-lens` (exactly this — must match the project config)
3. Visibility: **Public** (required for free GitHub Pages)
4. Don't check any initialization boxes
5. Click **Create repository**

### Step 2 — Upload the project files

1. On your new empty repo page, click **"uploading an existing file"**
2. Drag the *contents* of the unzipped `tuition-lens` folder into the upload area
   (the files, not the folder itself — you should see `package.json`, `index.html`,
   `src/`, `public/`, `.github/` at the repo root)
3. Commit changes

### Step 3 — Enable GitHub Pages

1. Repo **Settings** → **Pages**
2. **Source:** GitHub Actions

### Step 4 — Wait ~2 minutes

The **Actions** tab shows the deploy running. Green checkmark = live at
`https://YOUR-USERNAME.github.io/tuition-lens`

---

## Level 2 — Add user accounts (optional)

Follow `SUPABASE_SETUP.md`. The short version:
1. Create a free Supabase project
2. Run `supabase-schema.sql` in the Supabase SQL editor
3. Paste your project URL + anon key into `src/supabaseConfig.js`
4. Set the Site URL in Supabase auth settings to your GitHub Pages URL
5. Commit — GitHub Actions redeploys automatically

Until you do this, the app simply runs in anonymous-only mode (no login UI shown).

---

## Making future changes

When you want to update the app:
1. Edit the file on GitHub (or get an updated file from Claude and replace it)
2. Commit
3. GitHub Actions automatically rebuilds and redeploys within ~2 minutes

Most app logic is in `src/CollegePlanner.jsx`. Auth logic is in `src/Auth.jsx`
and `src/storage.js`.

---

## Project structure

- `src/CollegePlanner.jsx` — the main app (cost modeling, school comparison, settings)
- `src/App.jsx` — wrapper handling auth state + storage routing
- `src/Auth.jsx` — login/signup UI components
- `src/storage.js` — storage abstraction (localStorage for anonymous, Supabase for logged-in)
- `src/supabaseConfig.js` — your Supabase credentials (or placeholders for anonymous-only)
- `public/schools_data.json` — IPEDS data for 1,569 colleges
- `src/main.jsx` — entry point
- `index.html`, `vite.config.js`, `tailwind.config.js`, `package.json` — build config
- `.github/workflows/deploy.yml` — auto-deploy on every push
- `SUPABASE_SETUP.md` — account setup guide
- `supabase-schema.sql` — database setup script

---

## How multi-user works

- **Anonymous users:** data lives in their browser's localStorage. Two anonymous
  users never see each other's data — they're on different browsers.
- **Logged-in users:** data lives in Supabase, isolated per account by Row Level
  Security (enforced by the database, not the app). A user logged in on their
  phone and laptop sees the same data.
- **Switching:** logging in swaps the storage backend; logging out swaps back.
  New account holders with existing anonymous data get a one-time import offer.

---

## Troubleshooting

**Site shows 404 / blank page:**
- Repo must be named exactly `tuition-lens` (or edit `base` in `vite.config.js`)

**Schools data doesn't load:**
- Confirm `public/schools_data.json` is in the repo

**Login button doesn't appear:**
- That's expected until you complete `SUPABASE_SETUP.md`. Anonymous mode works regardless.

**Auth errors after Supabase setup:**
- Check `src/supabaseConfig.js` values have no trailing spaces
- Confirm the Site URL is set in Supabase (SUPABASE_SETUP.md Step 5)

