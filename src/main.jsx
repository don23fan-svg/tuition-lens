import React from 'react';
import ReactDOM from 'react-dom/client';
import CollegePlanner from './CollegePlanner.jsx';
import './index.css';

// Polyfill for the storage API used by the persistence feature.
// In the original artifact runtime, window.storage was provided by Anthropic.
// For a deployed website, we map it to browser localStorage so saved scenarios
// and settings persist across sessions for each user on their own device.
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key);
      return value !== null ? { value } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
      return { value };
    },
    delete: async (key) => {
      localStorage.removeItem(key);
      return { deleted: true };
    },
    list: async (prefix) => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!prefix || k.startsWith(prefix)) keys.push(k);
      }
      return { keys };
    },
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CollegePlanner />
  </React.StrictMode>
);
