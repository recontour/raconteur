import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; state?: string };
}

interface HotelProperty {
  name: string;
  description?: string;
  link?: string;
  rate_per_night?: { lowest?: string };
  overall_rating?: number;
  reviews?: number;
  images?: { thumbnail?: string }[];
}

interface HotelsApiResponse {
  properties?: HotelProperty[];
  error?: string;
}

// GET ?q=query → Nominatim place autocomplete (worldwide)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Raconteur/1.0", "Accept-Language": "en" },
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const results = await res.json() as NominatimResult[];
    const seen = new Set<string>();
    const suggestions = results
      .map((r) => {
        const parts = r.display_name.split(", ");
        const name = r.address?.city ?? r.address?.town ?? r.address?.village ?? parts[0];
        const state = r.address?.state ?? parts[parts.length - 2] ?? "";
        return { name, state, displayName: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
      })
      .filter((s) => {
        const key = s.name + s.state;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[destinations GET]", err);
    return NextResponse.json({ suggestions: [] });
  }
}

// POST { placeName } → SerpAPI google_hotels for top resorts
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try { await adminAuth.verifyIdToken(idToken); } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { placeName?: string };
  const { placeName } = body;
  if (!placeName) return NextResponse.json({ error: "placeName required" }, { status: 400 });

  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) return NextResponse.json({ error: "SERPAPI_KEY not configured" }, { status: 503 });

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const serpUrl = new URL("https://serpapi.com/search.json");
  serpUrl.searchParams.set("engine", "google_hotels");
  serpUrl.searchParams.set("q", `resorts in ${placeName}`);
  serpUrl.searchParams.set("check_in_date", fmt(tomorrow));
  serpUrl.searchParams.set("check_out_date", fmt(dayAfter));
  serpUrl.searchParams.set("hl", "en");
  serpUrl.searchParams.set("api_key", serpKey);

  try {
    const res = await fetch(serpUrl.toString());
    const data = await res.json() as HotelsApiResponse;
    if (!res.ok) {
      console.error("[destinations POST] SerpAPI error:", data.error);
      return NextResponse.json({ resorts: [] });
    }
    const resorts = (data.properties ?? []).slice(0, 4).map((p) => ({
      name: p.name,
      description: p.description,
      link: p.link,
      price: p.rate_per_night?.lowest,
      rating: p.overall_rating,
      reviews: p.reviews,
      thumbnail: p.images?.[0]?.thumbnail,
    }));
    return NextResponse.json({ resorts });
  } catch (err) {
    console.error("[destinations POST] fetch error:", err);
    return NextResponse.json({ resorts: [] });
  }
}
