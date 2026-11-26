"use client";

import { useEffect } from "react";

/** Înregistrează service worker-ul (necesar pentru push și pentru instalarea ca aplicație). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
