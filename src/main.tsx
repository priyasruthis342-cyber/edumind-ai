// Suppress noisy third-party browser extension warnings (e.g. McAfee WebAdvisor feature_collector.js)
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('using deprecated parameters for the initialization function')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
