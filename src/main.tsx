// Suppress noisy third-party browser extension errors & warnings (e.g. McAfee WebAdvisor feature_collector.js)
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('using deprecated parameters for the initialization function') ||
       args[0].includes('feature_collector'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    if (
      (event.filename && event.filename.includes('feature_collector')) ||
      (event.message && event.message.includes('feature_collector'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
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
