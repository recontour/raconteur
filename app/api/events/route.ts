import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ── GET: return most recent history entry for the authenticated user ──────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let snap;
  try {
    snap = await adminDb
      .collection("history")
      .where("uid", "==", uid)
      .limit(20)
      .get();
  } catch (err) {
    console.error("[events GET] Firestore query failed:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (snap.empty) return NextResponse.json({ history: null });

  // Sort in JS to avoid needing a composite index
  const sorted = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));

  const doc = sorted[0];
  return NextResponse.json({
    history: {
      city: doc.city ?? null,
      events: (doc.events ?? []).slice(0, 4),
      timestamp: doc.timestamp?.toMillis?.() ?? null,
    },
  });
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResponse {
  address: NominatimAddress;
}

interface SerpEvent {
  title: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name: string; rating?: number; reviews?: number };
}

interface SerpApiResponse {
  events_results?: SerpEvent[];
  error?: string;
}

export async function POST(req: NextRequest) {
  // ── 1. Verify auth token ────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { lat?: number; lng?: number };
  const { lat, lng } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  // ── 3. Reverse geocode via Nominatim (free, no key) ───────────────────────
  let city = "Mumbai"; // India fallback
  let locationParam = "India";
  let gl = "in"; // India by default

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "Raconteur/1.0",
          "Accept-Language": "en",
        },
      }
    );
    if (geoRes.ok) {
      const geo = await geoRes.json() as NominatimResponse;
      const addr = geo.address;
      city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? "Mumbai";
      const parts = [city, addr.state, "India"].filter(Boolean);
      locationParam = parts.join(", ");
      gl = "in"; // always India
    }
  } catch (err) {
    console.warn("[events] Nominatim failed, using fallback:", err);
  }

  const query = `music events in ${city}`;

  // ── 4. Quota guard: return cached result if same uid+city within 24 h ────
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSnap = await adminDb
    .collection("history")
    .where("uid", "==", uid)
    .where("city", "==", city)
    .where("timestamp", ">=", cutoff)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (!recentSnap.empty) {
    const cached = recentSnap.docs[0].data();
    return NextResponse.json({ city, events: cached.events ?? [] });
  }

  // ── 5. Call SerpAPI ───────────────────────────────────────────────────────
  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) {
    return NextResponse.json({ error: "SERPAPI_KEY not configured" }, { status: 503 });
  }

  const serpUrl = new URL("https://serpapi.com/search.json");
  serpUrl.searchParams.set("engine", "google_events");
  serpUrl.searchParams.set("q", query);
  serpUrl.searchParams.set("hl", "en");
  serpUrl.searchParams.set("gl", gl);
  if (locationParam) serpUrl.searchParams.set("location", locationParam);
  serpUrl.searchParams.set("htichips", "date:week");
  serpUrl.searchParams.set("api_key", serpKey);

  let events: SerpEvent[] = [];
  try {
    const serpRes = await fetch(serpUrl.toString());
    if (serpRes.ok) {
      const data = await serpRes.json() as SerpApiResponse;
      // Strip to only what we need — keep docs lean
      events = (data.events_results ?? []).slice(0, 10).map((e) => ({
        title: e.title,
        date: e.date,
        address: e.address,
        link: e.link,
        thumbnail: e.thumbnail,
        venue: e.venue ? { name: e.venue.name, rating: e.venue.rating, reviews: e.venue.reviews } : undefined,
      }));
    } else {
      const err = await serpRes.json().catch(() => ({})) as SerpApiResponse;
      console.error("[events] SerpAPI error:", err.error);
    }
  } catch (err) {
    console.error("[events] SerpAPI fetch failed:", err);
  }

  // ── 6. Save to Firestore history collection ───────────────────────────────
  try {
    await adminDb.collection("history").add({
      uid,
      city,
      lat,
      lng,
      query,
      events,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[events] Firestore write failed (non-fatal):", err);
  }

  return NextResponse.json({ city, events });
}
