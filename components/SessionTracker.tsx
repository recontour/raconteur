"use client";

import { useEffect } from "react";
import { createAnonSession } from "@/app/actions/user";

export default function SessionTracker() {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-fatal
      });
    }

    // Create or update anonymous session
    let anonId = localStorage.getItem("raconteur_anon");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("raconteur_anon", anonId);
    }

    createAnonSession(anonId, navigator.userAgent).catch(() => {
      // Non-fatal — session tracking failure should not break the UI
    });
  }, []);

  return null;
}
