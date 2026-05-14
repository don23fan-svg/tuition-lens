# Tuition Lens — Supabase Setup Guide

This adds user accounts so people can save scenarios to their own private account
and access them from any device. Anonymous "try without an account" mode still works
exactly as before (data stored in that browser only).

You only do this setup **once**. Budget about 15 minutes.

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and click **Start your project** (sign up with GitHub — easiest)
2. Click **New project**
3. Fill in:
   - **Name:** `tuition-lens`
   - **Database password:** click "Generate a password" and **save it somewhere** (you likely won't need it again, but don't lose it)
   - **Region:** pick the one closest to you (e.g., "East US")
4. Click **Create new project**
5. Wait ~2 minutes while it provisions

---

## Step 2 — Run the database setup script

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **+ New query**
3. Copy the entire contents of `supabase-schema.sql` (included in this project) and paste it in
4. Click **Run** (bottom right)
5. You should see "Success. No rows returned." — that's correct

This creates one table (`user_data`) with Row Level Security enabled, so each user
can only ever read or write their own rows. The security is enforced by the database
itself, not the app — even a bug in the frontend can't leak one user's data to another.

---

## Step 3 — Get your two config values

1. In Supabase, click **Project Settings** (the gear icon, bottom of the left sidebar)
2. Click **API** in the settings menu
3. You need two values from this page:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon public** key — a long string under "Project API keys" (the one labeled `anon` / `public`, NOT the `service_role` one)

**Note:** The `anon public` key is safe to put in your frontend code. It's designed
to be public. Security comes from the Row Level Security rules you ran in Step 2.
Never use the `service_role` key in frontend code — that one bypasses security.

---

## Step 4 — Add the config to the app

1. In your project, open the file `src/supabaseConfig.js`
2. Replace the two placeholder values with your real ones:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-public-key-here';
```

3. Save / commit. GitHub Actions will redeploy automatically.

---

## Step 5 — Configure auth settings (important for the deployed site)

1. In Supabase, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your GitHub Pages URL: `https://YOUR-USERNAME.github.io/tuition-lens`
3. Under **Redirect URLs**, add the same URL
4. Save

This tells Supabase it's allowed to send people back to your site after they
click email confirmation / password reset links.

### Optional: turn off email confirmation for easier testing

By default Supabase makes users confirm their email before they can log in.
For testing with family, you may want to skip that:

1. **Authentication** → **Providers** → **Email**
2. Toggle **off** "Confirm email"
3. Save

(For a real public product you'd leave this ON. For a family tool, off is fine.)

---

## That's it

Once deployed:
- Visitors can use the app immediately with no account (anonymous mode, browser-only storage)
- They can click **Sign up** any time to create an account
- When they sign up, if they have anonymous data in that browser, the app offers to
  import it into their new account
- Logged-in users' data syncs to Supabase and follows them across devices

---

## Troubleshooting

**"Failed to fetch" or auth errors:**
- Double-check the URL and anon key in `src/supabaseConfig.js` — no trailing spaces
- Confirm Step 5 (Site URL / Redirect URLs) is done

**Sign-up works but login says "Email not confirmed":**
- Either confirm via the email Supabase sent, or do the optional Step 5 toggle

**"new row violates row-level security policy":**
- The Step 2 SQL script didn't run completely. Re-run it.

**Want to see your users / data:**
- Supabase dashboard → **Authentication** → **Users** shows accounts
- **Table Editor** → `user_data` shows stored scenarios (each row tied to a user_id)
