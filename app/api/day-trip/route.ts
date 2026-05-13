import { type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Types ─────────────────────────────────────────────────────────────────────
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
}

interface SerpLocalItem {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  thumbnail?: string;
  hours?: string[];
  description?: string;
  link?: string;
  gps_coordinates?: { latitude: number; longitude: number };
}
interface SerpLocalResponse {
  local_results?: SerpLocalItem[];
  error?: string;
}

interface SerpEventItem {
  title: string;
  date?: { when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name: string; rating?: number };
}
interface SerpEventsResponse {
  events_results?: SerpEventItem[];
}

export interface DayTripPlace {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  thumbnail?: string;
  description?: string;
  link?: string;
  distanceKm?: number;
}

export interface DayTripEvent {
  title: string;
  when?: string;
  address?: string;
  link?: string;
  thumbnail?: string;
  venue?: string;
}

export interface DayTripResponse {
  city: string;
  places: DayTripPlace[];
  events: DayTripEvent[];
}

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  const idToken = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!idToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { city?: string };
  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city) return Response.json({ error: "city required" }, { status: 400 });

  // ── Firestore cityIndex cache ──────────────────────────────────────────
  const cacheKey = city.toLowerCase().replace(/\s+/g, "_");
  try {
    const snap = await adminDb.collection("cityIndex").doc(cacheKey).get();
    const cached = snap.data() as { city: string; places: DayTripPlace[]; events: DayTripEvent[]; fetchedAt: { toMillis: () => number } } | undefined;
    if (cached?.fetchedAt && Date.now() - cached.fetchedAt.toMillis() < CACHE_TTL_MS) {
      return Response.json({ city: cached.city, places: cached.places, events: cached.events, cached: true });
    }
  } catch { /* proceed to fresh fetch */ }

  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) return Response.json({ error: "SERPAPI_KEY not configured" }, { status: 503 });

  // ── Geocode city → lat/lon ────────────────────────────────────────────────
  let lat = 0, lon = 0, resolvedCity = city;
  try {
    const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
    geoUrl.searchParams.set("q", city);
    geoUrl.searchParams.set("format", "json");
    geoUrl.searchParams.set("limit", "1");
    geoUrl.searchParams.set("addressdetails", "1");

    const geoRes = await fetch(geoUrl.toString(), {
      headers: { "User-Agent": "Raconteur/1.0", "Accept-Language": "en" },
    });
    if (geoRes.ok) {
      const results = (await geoRes.json()) as NominatimResult[];
      if (results[0]) {
        lat = parseFloat(results[0].lat);
        lon = parseFloat(results[0].lon);
        const a = results[0].address;
        resolvedCity = a?.city ?? a?.town ?? a?.village ?? city;
      }
    }
  } catch (err) {
    console.warn("[day-trip] Nominatim failed:", err);
  }

  // ── Parallel: attractions within ~100 km + local events ──────────────────
  const [placesRes, eventsRes] = await Promise.allSettled([
    // SerpAPI google_local — "things to do near {city}"
    (async () => {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_local");
      url.searchParams.set("q", `places to visit near ${resolvedCity}`);
      url.searchParams.set("location", resolvedCity);
      url.searchParams.set("hl", "en");
      url.searchParams.set("num", "20");
      url.searchParams.set("api_key", serpKey);
      const res = await fetch(url.toString());
      if (!res.ok) return [] as DayTripPlace[];
      const data = (await res.json()) as SerpLocalResponse;
      return (data.local_results ?? [])
        .map((p): DayTripPlace => {
          const distanceKm =
            lat && lon && p.gps_coordinates
              ? Math.round(haversineKm(lat, lon, p.gps_coordinates.latitude, p.gps_coordinates.longitude))
              : undefined;
          return {
            title: p.title,
            address: p.address,
            rating: p.rating,
            reviews: p.reviews,
            type: p.type,
            thumbnail: p.thumbnail,
            description: p.description,
            link: p.link,
            distanceKm,
          };
        })
        // keep only places within 100 km if we have coords, otherwise keep all
        .filter((p) => p.distanceKm === undefined || p.distanceKm <= 100)
        .slice(0, 6);
    })(),

    // SerpAPI google_events — events this week near city
    (async () => {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_events");
      url.searchParams.set("q", `events near ${resolvedCity}`);
      url.searchParams.set("hl", "en");
      url.searchParams.set("htichips", "date:week");
      url.searchParams.set("api_key", serpKey);
      const res = await fetch(url.toString());
      if (!res.ok) return [] as DayTripEvent[];
      const data = (await res.json()) as SerpEventsResponse;
      return (data.events_results ?? []).slice(0, 4).map((e): DayTripEvent => ({
        title: e.title,
        when: e.date?.when,
        address: e.address?.[0],
        link: e.link,
        thumbnail: e.thumbnail,
        venue: e.venue?.name,
      }));
    })(),
  ]);

  const places = placesRes.status === "fulfilled" ? placesRes.value : [];
  const events = eventsRes.status === "fulfilled" ? eventsRes.value : [];

  const result: DayTripResponse = { city: resolvedCity, places, events };

  // ── Save to Firestore cityIndex ─────────────────────────────────────
  try {
    const safePlaces = places.map((p) =>
      Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
    );
    const safeEvents = events.map((e) =>
      Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined))
    );
    await adminDb.collection("cityIndex").doc(cacheKey).set({
      city: resolvedCity,
      places: safePlaces,
      events: safeEvents,
      fetchedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[day-trip] Firestore cache write failed:", err);
  }

  return Response.json(result);
}
