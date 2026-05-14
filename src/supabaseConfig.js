// ============================================================================
// Supabase Configuration
// ============================================================================
// Replace these two values with your own from the Supabase dashboard.
// See SUPABASE_SETUP.md (Steps 3 & 4) for where to find them.
//
// These values are SAFE to commit to a public repo. The anon key is designed
// to be public — security is enforced by Row Level Security in the database.
//
// If these are left as the placeholder values, the app runs in anonymous-only
// mode (no accounts, localStorage only) — which is a fine way to demo it.
// ============================================================================

export const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Whether Supabase is actually configured. If not, the app stays in
// anonymous-only mode and never shows login UI.
export const SUPABASE_CONFIGURED =
  SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE' &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE' &&
  SUPABASE_URL.startsWith('https://');
