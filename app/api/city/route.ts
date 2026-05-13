import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const WEEK_S = 7 * 24 * 60 * 60; // 7 days in seconds

/** Stable Firestore document key for a city name. */
function cityKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function POST(req: NextRequest) {
  // ── Parse body — accept { lat, lng } or { city } ──────────────────────────
  let queryParam: string;
  try {
    const body = await req.json() as { lat?: unknown; lng?: unknown; city?: unknown };
    if (typeof body.city === "string" && body.city.trim().length > 0) {
      queryParam = `q=${encodeURIComponent(body.city.trim())}`;
    } else if (typeof body.lat === "number" && typeof body.lng === "number") {
      queryParam = `lat=${body.lat}&lon=${body.lng}`;
    } else {
      return NextResponse.json({ error: "Provide { lat, lng } or { city }" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = process.env.OWM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OWM_API_KEY not configured" }, { status: 500 });
  }

  // ── Fetch OWM weather first (always needed to resolve city name + coords) ──
  type OWMWeather = {
    main: { temp: number; feels_like: number };
    weather: { icon: string; description: string }[];
    name: string;
    coord: { lat: number; lon: number };
  };
  type OWMAir = { list: { main: { aqi: number } }[] };

  let w: OWMWeather;
  try {
    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${queryParam}&appid=${key}&units=metric`,
      { next: { revalidate: 600 } }
    );
    if (!wRes.ok) {
      const errBody = await wRes.json().catch(() => ({}));
      console.error("[city] OWM weather error", wRes.status, errBody);
      return NextResponse.json({ error: "Upstream weather API error" }, { status: 502 });
    }
    w = await wRes.json() as OWMWeather;
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  const docId = cityKey(w.name);
  const ref = adminDb.collection("cityIndex").doc(docId);

  // ── Check cityIndex cache (fresh = within 7 days) ─────────────────────────
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const cached = snap.data() as {
        lastFetched: Timestamp;
        city: string;
        lat: number;
        lon: number;
        temp: number;
        feelsLike: number;
        icon: string;
        description: string;
        aqi: number;
      };
      const ageS = (Date.now() / 1000) - cached.lastFetched.seconds;
      if (ageS < WEEK_S) {
        return NextResponse.json({
          temp: cached.temp,
          feelsLike: cached.feelsLike,
          icon: cached.icon,
          description: cached.description,
          city: cached.city,
          aqi: cached.aqi,
        });
      }
    }
  } catch (err) {
    // Cache miss on Firestore error — fall through to live fetch
    console.warn("[city] cityIndex read failed, fetching live:", err);
  }

  // ── Fetch AQI (only when cache is stale / missing) ────────────────────────
  let aqi = 1;
  try {
    const aRes = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${w.coord.lat}&lon=${w.coord.lon}&appid=${key}`,
      { next: { revalidate: 600 } }
    );
    if (aRes.ok) {
      const a = await aRes.json() as OWMAir;
      aqi = a.list[0].main.aqi;
    }
  } catch {
    console.warn("[city] AQI fetch failed, using default");
  }

  const payload = {
    city: w.name,
    lat: w.coord.lat,
    lon: w.coord.lon,
    temp: Math.round(w.main.temp),
    feelsLike: Math.round(w.main.feels_like),
    icon: w.weather[0].icon,
    description: w.weather[0].description,
    aqi,
    lastFetched: FieldValue.serverTimestamp(),
  };

  // ── Persist to cityIndex (fire-and-forget — don't block the response) ──────
  ref.set(payload, { merge: true }).catch((err) =>
    console.warn("[city] cityIndex write failed:", err)
  );

  return NextResponse.json({
    temp: payload.temp,
    feelsLike: payload.feelsLike,
    icon: payload.icon,
    description: payload.description,
    city: payload.city,
    aqi: payload.aqi,
  });
}

