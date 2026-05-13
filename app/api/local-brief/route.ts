import { type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Types ─────────────────────────────────────────────────────────────────────
interface SerpNewsItem {
  title: string;
  link?: string;
  source?: { name?: string; icon?: string };
  date?: string;
  thumbnail?: string;
  snippet?: string;
}
interface SerpNewsResponse {
  news_results?: SerpNewsItem[];
  error?: string;
}

export interface NewsItem {
  title: string;
  snippet?: string;
  source?: string;
  link?: string;
  thumbnail?: string;
  date?: string;
}

export interface ActivityItem {
  label: string;
  emoji: string;
}

// ── GET: return cached brief ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const idToken = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!idToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const snap = await adminDb.collection("userIndex").doc(uid).get();
    const brief = (snap.data() ?? {}).localBrief as {
      city: string;
      news: NewsItem[];
      activities: ActivityItem[];
      fetchedAt: { toMillis: () => number };
    } | undefined;

    if (brief?.fetchedAt && Date.now() - brief.fetchedAt.toMillis() < CACHE_TTL_MS) {
      return Response.json({ city: brief.city, news: brief.news, activities: brief.activities, cached: true });
    }
  } catch { /* non-fatal */ }

  return Response.json({ news: [], activities: [], cached: false });
}

// ── POST: fetch fresh brief for a city ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const idToken = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!idToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { city?: string };
  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city) return Response.json({ error: "city required" }, { status: 400 });

  // ── Check cache first ────────────────────────────────────────────────────────
  try {
    const snap = await adminDb.collection("userIndex").doc(uid).get();
    const cached = (snap.data() ?? {}).localBrief as {
      city: string;
      news: NewsItem[];
      activities: ActivityItem[];
      fetchedAt: { toMillis: () => number };
    } | undefined;
    if (
      cached?.city?.toLowerCase() === city.toLowerCase() &&
      cached?.fetchedAt &&
      Date.now() - cached.fetchedAt.toMillis() < CACHE_TTL_MS
    ) {
      return Response.json({ city: cached.city, news: cached.news, activities: cached.activities, cached: true });
    }
  } catch { /* proceed to fresh fetch */ }

  // ── Fetch news ────────────────────────────────────────────────────────────────
  let news: NewsItem[] = [];
  const serpKey = process.env.SERPAPI_KEY;

  if (serpKey) {
    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_news");
      url.searchParams.set("q", `${city} travel`);
      url.searchParams.set("hl", "en");
      url.searchParams.set("api_key", serpKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as SerpNewsResponse;
        news = (data.news_results ?? []).slice(0, 4).map((n) => ({
          title: n.title,
          snippet: n.snippet,
          source: n.source?.name,
          link: n.link,
          thumbnail: n.thumbnail,
          date: n.date,
        }));
      }
    } catch (err) {
      console.warn("[local-brief] SerpAPI news failed:", err);
    }
  }

  // ── Gemini fallback for news ───────────────────────────────────────────────
  if (news.length === 0) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: `You are a travel reporter. Write a short 50-word travel brief about ${city} covering something current, interesting, or unmissable for visitors. Reply ONLY with valid JSON — no markdown, no explanation: {"title":"...","snippet":"..."}`,
      });
      const text = (result.text ?? "").trim().replace(/```json|```/g, "").trim();
      const item = JSON.parse(text) as { title: string; snippet: string };
      news = [{ title: item.title, snippet: item.snippet, source: "Travel Brief" }];
    } catch (err) {
      console.warn("[local-brief] Gemini news fallback failed:", err);
      news = [{ title: `Discover ${city}`, snippet: `${city} offers rich culture, cuisine, and unforgettable experiences for every kind of traveller.`, source: "Travel Brief" }];
    }
  }

  // ── Gemini activities ─────────────────────────────────────────────────────
  let activities: ActivityItem[] = [];
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `List 6 popular travel activities in ${city}. Reply ONLY with a JSON array — no markdown, no explanation. Each item must have "label" (3 words max) and "emoji" (one emoji). Example: [{"label":"Street food","emoji":"🍜"}]`,
    });
    const text = (result.text ?? "").trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text) as ActivityItem[];
    if (Array.isArray(parsed)) activities = parsed.slice(0, 6);
  } catch (err) {
    console.warn("[local-brief] Gemini activities failed:", err);
    activities = [
      { label: "Local cuisine", emoji: "🍽️" },
      { label: "City walks", emoji: "🚶" },
      { label: "Museums", emoji: "🏛️" },
      { label: "Markets", emoji: "🛍️" },
      { label: "Nightlife", emoji: "🌃" },
      { label: "Day trips", emoji: "🚗" },
    ];
  }

  // ── Cache in userIndex ────────────────────────────────────────────────────
  try {
    await adminDb.collection("userIndex").doc(uid).set(
      { localBrief: { city, news, activities, fetchedAt: FieldValue.serverTimestamp() } },
      { merge: true }
    );
  } catch (err) {
    console.warn("[local-brief] Firestore cache write failed:", err);
  }

  return Response.json({ city, news, activities });
}
