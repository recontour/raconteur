import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SerpImageResult {
  original?: string;
  thumbnail?: string;
}
interface SerpImageResponse {
  images_results?: SerpImageResult[];
  error?: string;
}

/**
 * Returns top 4 photo URLs for the given city.
 * Uses SerpAPI Google Images (same key already used in the app).
 * Cached in cityIndex/{docKey} under `cityImages` / `imagesFetchedAt` with 30-day TTL.
 */
export async function getCityImages(city: string, docKey: string): Promise<string[]> {
  // ── 1. Serve from cache if still fresh ────────────────────────────────────
  try {
    const snap = await adminDb.collection("cityIndex").doc(docKey).get();
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>;
      const imgs = d.cityImages as string[] | undefined;
      const fetchedAt = d.imagesFetchedAt as { toMillis: () => number } | undefined;
      if (imgs?.length && fetchedAt && Date.now() - fetchedAt.toMillis() < MONTH_MS) {
        return imgs;
      }
    }
  } catch { /* fall through to live fetch */ }

  // ── 2. Live fetch via SerpAPI Google Images ────────────────────────────────
  const serpKey = (process.env.SERPAPI_KEY ?? "").trim();

  if (!serpKey) {
    console.warn("[cityImages] SERPAPI_KEY not configured");
    return [];
  }

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine",  "google_images");
    url.searchParams.set("q",       `${city} city travel landmark`);
    url.searchParams.set("num",     "4");
    url.searchParams.set("safe",    "active");
    url.searchParams.set("api_key", serpKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn("[cityImages] SerpAPI responded", res.status);
      return [];
    }

    const data = (await res.json()) as SerpImageResponse;
    if (data.error) {
      console.warn("[cityImages] SerpAPI error:", data.error);
      return [];
    }

    // Prefer full-size `original`; fall back to `thumbnail`
    const images = (data.images_results ?? [])
      .slice(0, 4)
      .map((r) => r.original ?? r.thumbnail ?? "")
      .filter(Boolean);

    // ── 3. Persist to cache (fire-and-forget) ──────────────────────────────
    if (images.length > 0) {
      adminDb.collection("cityIndex").doc(docKey).set(
        { cityImages: images, imagesFetchedAt: FieldValue.serverTimestamp() },
        { merge: true }
      ).catch((e) => console.warn("[cityImages] cache write failed:", e));
    }

    return images;
  } catch (err) {
    console.warn("[cityImages] fetch failed:", err);
    return [];
  }
}
