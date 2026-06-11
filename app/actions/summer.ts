"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface SummerCachePayload {
  // identity
  sessionId:                  string;
  userId?:                    string | null;
  event:                      string;
  timestamp:                  number;
  // browser / UA
  userAgent?:                 string;
  platform?:                  string;
  language?:                  string;
  languages?:                 string[];
  vendor?:                    string;
  // hardware
  hardwareConcurrency?:       number;
  deviceMemory?:              number;
  maxTouchPoints?:            number;
  cookieEnabled?:             boolean;
  doNotTrack?:                string | null;
  onLine?:                    boolean;
  // screen
  screenWidth?:               number;
  screenHeight?:              number;
  colorDepth?:                number;
  pixelDepth?:                number;
  devicePixelRatio?:          number;
  viewportWidth?:             number;
  viewportHeight?:            number;
  orientation?:               string;
  // network
  connectionType?:            string;
  connectionDownlink?:        number;
  connectionRtt?:             number;
  connectionSaveData?:        boolean;
  // locale / time
  timezone?:                  string;
  timezoneOffset?:            number;
  // preferences
  prefersColorScheme?:        string;
  prefersReducedMotion?:      boolean;
  // performance / memory
  navigationTiming?:          Record<string, number>;
  memoryJsHeapSizeLimit?:     number;
  memoryTotalJsHeapSize?:     number;
  memoryUsedJsHeapSize?:      number;
  // GPU / WebGL
  gpuRenderer?:               string;
  gpuVendor?:                 string;
  webglVersion?:              number;
  // audio
  audioContextSampleRate?:    number;
  // storage
  localStorageAvailable?:     boolean;
  sessionStorageAvailable?:   boolean;
  // battery
  batteryLevel?:              number;
  batteryCharging?:           boolean;
  // page context
  referrer?:                  string;
  href?:                      string;
  // extras
  historyLength?:             number;
  screenLeft?:                number;
  screenTop?:                 number;
  pluginCount?:               number;
  characterSet?:              string;
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Writes / merges a snapshot into: summer/{sessionId}/cache/{event}
 * Using the event name as the document ID means the same event type never
 * creates duplicates — it merges new fields in and leaves existing ones alone.
 * The parent doc also gets a lightweight summary merged in.
 */
export async function saveSummerCache(payload: SummerCachePayload) {
  try {
    const { sessionId, ...data } = payload;

    // Strip undefined so Firestore doesn't reject
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );

    // doc(event) = one doc per event type per session — merge keeps old fields
    await adminDb
      .collection("summer")
      .doc(sessionId)
      .collection("cache")
      .doc(payload.event)
      .set({ ...clean, savedAt: FieldValue.serverTimestamp() }, { merge: true });

    // Lightweight summary on parent doc — easy to query in console
    await adminDb
      .collection("summer")
      .doc(sessionId)
      .set(
        {
          lastEvent:   payload.event,
          lastSeen:    FieldValue.serverTimestamp(),
          userId:      payload.userId      ?? null,
          timezone:    payload.timezone    ?? null,
          userAgent:   payload.userAgent   ?? null,
          gpuRenderer: payload.gpuRenderer ?? null,
          screenRes:   payload.screenWidth && payload.screenHeight
            ? `${payload.screenWidth}x${payload.screenHeight}`
            : null,
        },
        { merge: true },
      );

    return { success: true };
  } catch (err) {
    console.error("saveSummerCache error:", err);
    return { success: false };
  }
}
