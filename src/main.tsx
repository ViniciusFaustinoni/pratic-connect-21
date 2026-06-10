// Polyfill ES2022 Object.hasOwn — browsers/WebViews antigos (Chromium <93,
// Safari <15.4, WebViews embarcadas como Omnidesk/Callix) quebram qualquer
// dependência moderna (Radix, react-hook-form, tanstack-query) que use o
// método. Definido ANTES de qualquer import para garantir cobertura.
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== "function") {
  Object.defineProperty(Object, "hasOwn", {
    value: (obj: object, prop: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(obj, prop),
    configurable: true,
    writable: true,
  });
}

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installPreviewGeolocationBypass } from "./lib/previewGeolocationBypass";

installPreviewGeolocationBypass();

// =============================================================
// Workaround: Scripts externos (Lovable preview token, extensões)
// podem manipular o DOM, causando erros "removeChild" e "insertBefore"
// durante o commit phase do React ao renderizar portais (Dialogs).
// Monkey-patch para capturar esses erros específicos silenciosamente.
// Ref: https://github.com/facebook/react/issues/17256
// =============================================================
if (typeof Node !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  // @ts-ignore
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn('[DOM Patch] removeChild: node is not a child — skipped (likely external script)');
      return child;
    }
    // @ts-ignore
    return originalRemoveChild.apply(this, arguments) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  // @ts-ignore
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[DOM Patch] insertBefore: reference node is not a child — skipped');
      return newNode;
    }
    // @ts-ignore
    return originalInsertBefore.apply(this, arguments) as T;
  };
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
