import { NextRequest, NextResponse } from "next/server";

const MOOD_QUERIES: Record<string, string> = {
  dawn:        "morning outdoor ambient birds festival",
  inquiry:     "gentle contemplative ambient",
  philosophic: "contemplative soft piano ambient",
  vivid:       "outdoor summer crowd festival ambient",
  pivot:       "tension suspense quiet ambient",
  descending:  "dark cellar basement ambient drone",
  harrowing:   "dark tense horror ambient drone",
  revelation:  "unsettling dark revelation strings",
  moral:       "somber grave strings ambient",
  reckoning:   "melancholy emotional piano ambient",
  impossible:  "eerie unsettling ambient drone",
  departure:   "night wind walking solitude ambient",
};

export async function GET(req: NextRequest) {
  const mood = req.nextUrl.searchParams.get("mood") ?? "dawn";
  const key  = process.env.FREESOUND_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "FREESOUND_API_KEY not set" }, { status: 500 });
  }

  const query = MOOD_QUERIES[mood] ?? "ambient";
  const apiUrl =
    `https://freesound.org/apiv2/search/text/` +
    `?query=${encodeURIComponent(query)}` +
    `&token=${key}` +
    `&fields=id,name,previews` +
    `&filter=duration:[30 TO 180]` +
    `&page_size=5` +
    `&sort=rating_desc`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Freesound error" }, { status: 502 });
    }
    const data = await res.json();
    const results: Array<{ previews?: Record<string, string> }> = data.results ?? [];
    if (!results.length) {
      return NextResponse.json({ url: null });
    }
    // Pick randomly from top results for variety
    const pick = results[Math.floor(Math.random() * results.length)];
    const url  = pick.previews?.["preview-hq-mp3"] ?? pick.previews?.["preview-lq-mp3"] ?? null;
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
