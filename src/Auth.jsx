import React, { useState } from 'react';
import { auth, authAvailable, hasLocalData, migrateLocalToAccount } from './storage.js';

// ============================================================================
// AuthModal — sign up / log in / reset password
// ============================================================================
export function AuthModal({ open, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!open) return null;

  function reset() {
    setError('');
    setNotice('');
    setBusy(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    reset();
    setBusy(true);

    if (mode === 'reset') {
      const { error } = await auth.resetPassword(email);
      setBusy(false);
      if (error) { setError(error.message); return; }
      setNotice('Check your email for a password reset link.');
      return;
    }

    if (mode === 'signup') {
      const { data, error } = await auth.signUp(email, password);
      setBusy(false);
      if (error) { setError(error.message); return; }
      // If email confirmation is on, there's no session yet.
      if (!data.session) {
        setNotice('Account created. Check your email to confirm, then log in.');
        setMode('login');
        return;
      }
      onAuthSuccess(data.session, /* isNewAccount */ true);
      return;
    }

    // login
    const { data, error } = await auth.signIn(email, password);
    setBusy(false);
    if (error) { setError(error.message); return; }
    onAuthSuccess(data.session, /* isNewAccount */ false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-1">
          <h2 className="font-display text-2xl font-medium">
            {mode === 'login' && 'Log in'}
            {mode === 'signup' && 'Create account'}
            {mode === 'reset' && 'Reset password'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-stone-600 mb-4">
          {mode === 'login' && 'Access your saved scenarios from any device.'}
          {mode === 'signup' && 'Save your scenarios and access them anywhere.'}
          {mode === 'reset' && "We'll email you a reset link."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
            <input type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
              placeholder="you@example.com" />
          </div>
          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Password</label>
              <input type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
                placeholder="At least 6 characters" />
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          {notice && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{notice}</div>}

          <button type="submit" disabled={busy}
            className="w-full py-2 bg-emerald-700 text-white text-sm font-medium rounded hover:bg-emerald-800 disabled:opacity-50">
            {busy ? 'Working…' :
              mode === 'login' ? 'Log in' :
              mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-4 text-xs text-stone-500 space-y-1">
          {mode === 'login' && (
            <>
              <div>
                No account?{' '}
                <button onClick={() => { setMode('signup'); reset(); }}
                  className="text-emerald-700 font-medium hover:underline">Sign up</button>
              </div>
              <div>
                <button onClick={() => { setMode('reset'); reset(); }}
                  className="text-emerald-700 font-medium hover:underline">Forgot password?</button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); reset(); }}
                className="text-emerald-700 font-medium hover:underline">Log in</button>
            </div>
          )}
          {mode === 'reset' && (
            <div>
              <button onClick={() => { setMode('login'); reset(); }}
                className="text-emerald-700 font-medium hover:underline">Back to log in</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MigrationPrompt — offer to import anonymous data into a new account
// ============================================================================
export function MigrationPrompt({ open, userId, onDone }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  async function handleImport() {
    setBusy(true);
    const count = await migrateLocalToAccount(userId);
    setResult(count);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        {result === null ? (
          <>
            <h2 className="font-display text-xl font-medium mb-2">Import your existing work?</h2>
            <p className="text-sm text-stone-600 mb-4">
              We found scenarios and settings saved in this browser. Want to copy them
              into your new account so they sync across your devices?
            </p>
            <div className="flex gap-2">
              <button onClick={handleImport} disabled={busy}
                className="flex-1 py-2 bg-emerald-700 text-white text-sm font-medium rounded hover:bg-emerald-800 disabled:opacity-50">
                {busy ? 'Importing…' : 'Yes, import it'}
              </button>
              <button onClick={() => onDone(false)} disabled={busy}
                className="flex-1 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded hover:bg-stone-50 disabled:opacity-50">
                Start fresh
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl font-medium mb-2">Imported</h2>
            <p className="text-sm text-stone-600 mb-4">
              Copied {result} item{result === 1 ? '' : 's'} into your account. Your data
              now syncs across devices when you're logged in.
            </p>
            <button onClick={() => onDone(true)}
              className="w-full py-2 bg-emerald-700 text-white text-sm font-medium rounded hover:bg-emerald-800">
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AccountButton — shows in the header. Login button OR account menu.
// ============================================================================
export function AccountButton({ session, onLoginClick, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!authAvailable) return null;

  if (!session) {
    return (
      <button onClick={onLoginClick}
        className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-medium rounded-md transition-colors">
        Log in / Sign up
      </button>
    );
  }

  const email = session.user?.email || 'Account';
  const initial = email[0]?.toUpperCase() || '?';

  return (
    <div className="relative">
      <button onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-2 py-1.5 bg-white/15 hover:bg-white/25 text-white text-sm rounded-md transition-colors">
        <span className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs font-semibold">{initial}</span>
        <span className="max-w-[140px] truncate">{email}</span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-stone-200 z-50 py-1">
            <div className="px-3 py-2 text-xs text-stone-500 border-b border-stone-100">
              Signed in as<br /><span className="text-stone-800 font-medium">{email}</span>
            </div>
            <button onClick={() => { setMenuOpen(false); onSignOut(); }}
              className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// AnonymousBanner — gentle nudge shown to anonymous users
// ============================================================================
export function AnonymousBanner({ onLoginClick }) {
  const [dismissed, setDismissed] = useState(false);
  if (!authAvailable || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
        <span className="text-amber-900">
          You're using Tuition Lens without an account — your data is saved only in this browser.
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={onLoginClick}
            className="text-amber-900 font-medium hover:underline whitespace-nowrap">
            Create an account to sync
          </button>
          <button onClick={() => setDismissed(true)}
            className="text-amber-500 hover:text-amber-700 text-lg leading-none">×</button>
        </div>
      </div>
    </div>
  );
}
