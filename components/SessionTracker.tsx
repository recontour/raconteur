"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createAnonSession } from "@/app/actions/user";
import { useAuth } from "@/app/helper/auth";

export default function SessionTracker() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (confirm('A new version of Raconteur is available. Update now?')) {
                  window.location.reload();
                }
              }
            };
          }
        };
      }).catch(() => {
        // SW registration failure is non-fatal
      });
    }

    // Create or update anonymous session
    let anonId = localStorage.getItem("raconteur_anon");
    if (!anonId) {
      anonId = crypto.randomUUID();
      localStorage.setItem("raconteur_anon", anonId);
    }

    // Parse UA on client for immediate browser storage
    const ua = navigator.userAgent;
    const isMobile = /mobile/i.test(ua);
    const device = isMobile ? (/iPhone|iPad|iPod/.test(ua) ? 'iPhone' : 'Android') : 'Desktop';
    const browser = /edg/i.test(ua) ? 'Edge' : 
                    /chrome|crios/i.test(ua) ? 'Chrome' : 
                    /safari/i.test(ua) ? 'Safari' : 
                    /firefox/i.test(ua) ? 'Firefox' : 'Other';
    
    localStorage.setItem("raconteur_session_info", JSON.stringify({ device, browser }));

    // Trigger tracking on load/navigation
    createAnonSession(anonId, navigator.userAgent, user?.uid || null).catch((err) => {
      // Non-fatal — session tracking failure should not break the UI
      console.error("Session tracking failed:", err);
    });
  }, [user?.uid, pathname]);

  return null;
}
