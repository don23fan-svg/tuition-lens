import React, { useState, useEffect } from 'react';
import CollegePlanner from './CollegePlanner.jsx';
import { AuthModal, MigrationPrompt, AccountButton, AnonymousBanner } from './Auth.jsx';
import {
  storage, auth, authAvailable,
  useLocalStorage, useSupabaseStorage,
  hasLocalData,
} from './storage.js';

// Bind window.storage immediately at module load — before any component
// effects run. CollegePlanner was written against window.storage; this makes
// it work unchanged. The storage module routes to localStorage or Supabase.
// Default is localStorage; App's effect upgrades to Supabase if a session exists.
if (typeof window !== 'undefined') {
  window.storage = {
    get: (key) => storage.get(key),
    set: (key, value) => storage.set(key, value),
    delete: (key) => storage.delete(key),
    list: (prefix) => storage.list(prefix),
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  // Bump this to force CollegePlanner to remount & reload from the new backend
  // when auth state changes (login / logout swaps the whole data source).
  const [storageEpoch, setStorageEpoch] = useState(0);

  // Initial setup: check for existing session. window.storage is already bound
  // at module load (localStorage by default).
  useEffect(() => {
    if (!authAvailable) {
      // No Supabase configured — pure anonymous mode, exactly like before.
      useLocalStorage();
      setAuthChecked(true);
      return;
    }

    // Check for an existing logged-in session.
    auth.getSession().then((existingSession) => {
      if (existingSession) {
        useSupabaseStorage(existingSession.user.id);
        setSession(existingSession);
      } else {
        useLocalStorage();
      }
      setAuthChecked(true);
    });

    // Listen for auth changes (login, logout, token refresh, password reset).
    const subscription = auth.onAuthChange((newSession) => {
      if (newSession) {
        useSupabaseStorage(newSession.user.id);
        setSession(newSession);
      } else {
        useLocalStorage();
        setSession(null);
      }
      setStorageEpoch((e) => e + 1);
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleAuthSuccess(newSession, isNewAccount) {
    setAuthModalOpen(false);
    useSupabaseStorage(newSession.user.id);
    setSession(newSession);
    // If they just made an account and have anonymous data sitting in this
    // browser, offer to import it.
    if (isNewAccount && hasLocalData()) {
      setMigrationOpen(true);
    } else {
      setStorageEpoch((e) => e + 1);
    }
  }

  function handleMigrationDone() {
    setMigrationOpen(false);
    setStorageEpoch((e) => e + 1);
  }

  async function handleSignOut() {
    await auth.signOut();
    useLocalStorage();
    setSession(null);
    setStorageEpoch((e) => e + 1);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <>
      {/* Anonymous nudge banner — only when auth is available and not logged in */}
      {!session && <AnonymousBanner onLoginClick={() => setAuthModalOpen(true)} />}

      {/* The main app. Keyed by storageEpoch so it fully remounts and reloads
          its data whenever the storage backend changes (login/logout). */}
      <CollegePlanner
        key={storageEpoch}
        accountSlot={
          <AccountButton
            session={session}
            onLoginClick={() => setAuthModalOpen(true)}
            onSignOut={handleSignOut}
          />
        }
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <MigrationPrompt
        open={migrationOpen}
        userId={session?.user?.id}
        onDone={handleMigrationDone}
      />
    </>
  );
}
