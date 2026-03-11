import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suprimir erros de DOM causados por scripts externos (Lovable preview token, extensões)
// que manipulam document.body e conflitam com portais do Radix UI
const originalError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  const msg = typeof message === 'string' ? message : error?.message || '';
  if (msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('The node to be removed is not a child')) {
    console.warn('[main] Suppressed external DOM manipulation error');
    return true; // Prevent default handling
  }
  return originalError ? originalError(message, source, lineno, colno, error) : false;
};

// Also catch unhandled promise rejections with the same pattern
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (msg.includes('removeChild') || msg.includes('insertBefore')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
