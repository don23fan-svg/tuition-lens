import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Note: window.storage is now set up inside App.jsx via the storage module,
// which routes to either localStorage (anonymous) or Supabase (logged in).

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
