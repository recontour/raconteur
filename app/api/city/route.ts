import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(authHeader.slice(7));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate body — accept { lat, lng } or { city } ────────────────────────
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

  // ── Fetch OWM weather + air pollution ────────────────────────────────────
  // air_pollution only accepts lat/lon, so if we have a city name we must
  // fetch weather first to get coordinates, then fetch air_pollution.
  try {
    type OWMWeather = {
      main: { temp: number; feels_like: number };
      weather: { icon: string; description: string }[];
      name: string;
      coord: { lat: number; lon: number };
    };
    type OWMAir = { list: { main: { aqi: number } }[] };

    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${queryParam}&appid=${key}&units=metric`,
      { next: { revalidate: 600 } }
    );
    if (!wRes.ok) {
      const body = await wRes.json().catch(() => ({}));
      console.error("[city] OWM weather error", wRes.status, body);
      return NextResponse.json({ error: "Upstream weather API error", detail: body }, { status: 502 });
    }
    const w = await wRes.json() as OWMWeather;

    const aRes = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${w.coord.lat}&lon=${w.coord.lon}&appid=${key}`,
      { next: { revalidate: 600 } }
    );
    if (!aRes.ok) {
      const body = await aRes.json().catch(() => ({}));
      console.error("[city] OWM air_pollution error", aRes.status, body);
      return NextResponse.json({ error: "Upstream air quality API error", detail: body }, { status: 502 });
    }
    const a = await aRes.json() as OWMAir;

    return NextResponse.json({
      temp: Math.round(w.main.temp),
      feelsLike: Math.round(w.main.feels_like),
      icon: w.weather[0].icon,
      description: w.weather[0].description,
      city: w.name,
      aqi: a.list[0].main.aqi, // 1 (Good) – 5 (Very Poor)
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
