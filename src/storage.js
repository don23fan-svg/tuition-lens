// ============================================================================
// Storage & Auth Layer
// ============================================================================
// Exposes a single storage interface the app uses regardless of whether the
// user is anonymous (localStorage) or logged in (Supabase database).
//
// The app calls storage.get/set/delete/list exactly as before. This module
// decides where the data actually goes.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from './supabaseConfig.js';

// Create the Supabase client only if configured. Otherwise null — app runs
// in anonymous-only mode.
export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const authAvailable = SUPABASE_CONFIGURED;

// ----------------------------------------------------------------------------
// localStorage backend (anonymous users)
// ----------------------------------------------------------------------------
const localBackend = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value !== null ? { value } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { value };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { deleted: true };
  },
  async list(prefix) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return { keys };
  },
};

// ----------------------------------------------------------------------------
// Supabase backend (logged-in users)
// ----------------------------------------------------------------------------
function supabaseBackend(userId) {
  return {
    async get(key) {
      const { data, error } = await supabase
        .from('user_data')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if (error) {
        console.error('Supabase get error:', error);
        return null;
      }
      // App expects { value } where value is a string. We store JSON, so
      // stringify it back to match the localStorage contract.
      return data ? { value: JSON.stringify(data.value) } : null;
    },
    async set(key, value) {
      // value comes in as a JSON string from the app; parse to store as jsonb
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      const { error } = await supabase
        .from('user_data')
        .upsert(
          { user_id: userId, key, value: parsed },
          { onConflict: 'user_id,key' }
        );
      if (error) {
        console.error('Supabase set error:', error);
        return null;
      }
      return { value };
    },
    async delete(key) {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId)
        .eq('key', key);
      if (error) {
        console.error('Supabase delete error:', error);
        return null;
      }
      return { deleted: true };
    },
    async list(prefix) {
      let query = supabase.from('user_data').select('key').eq('user_id', userId);
      if (prefix) query = query.like('key', `${prefix}%`);
      const { data, error } = await query;
      if (error) {
        console.error('Supabase list error:', error);
        return { keys: [] };
      }
      return { keys: data.map((r) => r.key) };
    },
  };
}

// ----------------------------------------------------------------------------
// Active storage — swapped at runtime based on auth state
// ----------------------------------------------------------------------------
let activeBackend = localBackend;

export function useLocalStorage() {
  activeBackend = localBackend;
}

export function useSupabaseStorage(userId) {
  activeBackend = supabaseBackend(userId);
}

// The interface the app consumes. Mirrors the original window.storage shape.
export const storage = {
  get: (key) => activeBackend.get(key),
  set: (key, value) => activeBackend.set(key, value),
  delete: (key) => activeBackend.delete(key),
  list: (prefix) => activeBackend.list(prefix),
};

// ----------------------------------------------------------------------------
// Auth helpers
// ----------------------------------------------------------------------------
export const auth = {
  async signUp(email, password) {
    if (!supabase) return { error: { message: 'Accounts are not configured.' } };
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  },
  async signIn(email, password) {
    if (!supabase) return { error: { message: 'Accounts are not configured.' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },
  async signOut() {
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut();
    return { error };
  },
  async resetPassword(email) {
    if (!supabase) return { error: { message: 'Accounts are not configured.' } };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    return { error };
  },
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onAuthChange(callback) {
    if (!supabase) return { unsubscribe: () => {} };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return data.subscription;
  },
};

// ----------------------------------------------------------------------------
// Migration: copy anonymous localStorage data into a logged-in account
// ----------------------------------------------------------------------------
// The app's localStorage keys. Keep in sync with what the app actually uses.
const APP_KEYS = [
  'settings_v3',
  'student_v3',
  'funds529_v3',
  'selectedSchools_v3',
  'savedScenarios_v3',
];

// Returns true if there's any anonymous data worth offering to import.
export function hasLocalData() {
  return APP_KEYS.some((k) => localStorage.getItem(k) !== null);
}

// Copies all anonymous localStorage data into the given user's Supabase account.
// Does NOT clear localStorage — anonymous mode still works if they log out.
export async function migrateLocalToAccount(userId) {
  const backend = supabaseBackend(userId);
  let migrated = 0;
  for (const key of APP_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const result = await backend.set(key, value);
      if (result) migrated++;
    }
  }
  return migrated;
}
