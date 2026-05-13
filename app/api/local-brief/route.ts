import { type NextRequest } from "next/server";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getCityImages } from "@/app/helper/cityImages";

const ai = genkit({ plugins: [googleAI()] });
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BriefLink {
  title: string;
  url?: string;
  source?: string;
}

export interface LocalBriefPayload {
  city: string;
  paragraphs: string[];
  images: string[];
  links: BriefLink[];
}

/** Stable Firestore document key matching /api/city */
function cityDocKey(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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
    const snap   = await adminDb.collection("userIndex").doc(uid).get();
    const brief  = (snap.data() ?? {}).localBrief as Record<string, unknown> | undefined;
    const paras  = Array.isArray(brief?.paragraphs) ? (brief!.paragraphs as string[]) : [];
    const images = Array.isArray(brief?.images)     ? (brief!.images     as string[]) : [];

    if (
      paras.length > 0 &&
      images.length > 0 &&
      brief?.fetchedAt &&
      Date.now() - (brief.fetchedAt as { toMillis: () => number }).toMillis() < CACHE_TTL_MS
    ) {
      return Response.json({ city: brief.city, paragraphs: paras, images, links: [], cached: true });
    }
  } catch { /* non-fatal */ }

  return Response.json({ paragraphs: [], images: [], links: [], cached: false });
}

// ── POST: fetch fresh brief for a city ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const idToken = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  let uid: string | null = null;
  if (idToken) {
    try {
      uid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({})) as { city?: string };
  const city  = typeof body.city === "string" ? body.city.trim() : "";
  if (!city) return Response.json({ error: "city required" }, { status: 400 });

  // Stable Firestore doc key (mirrors the one in /api/city)
  const docKey  = cityDocKey(city);
  const cityRef = adminDb.collection("cityIndex").doc(docKey);

  // ── Check shared cityIndex brief cache ────────────────────────────────────
  try {
    const snap = await cityRef.get();
    if (snap.exists) {
      const d    = snap.data() as Record<string, unknown>;
      const bf   = d.brief as Record<string, unknown> | undefined;
      const paras  = Array.isArray(bf?.paragraphs) ? (bf!.paragraphs as string[]) : [];
      const images = Array.isArray(bf?.images)     ? (bf!.images     as string[]) : [];
      if (
        paras.length > 0 &&
        images.length > 0 &&
        bf?.briefFetchedAt &&
        Date.now() - (bf.briefFetchedAt as { toMillis: () => number }).toMillis() < CACHE_TTL_MS
      ) {
        return Response.json({ city, paragraphs: paras, images, links: [], cached: true });
      }
    }
  } catch { /* fall through */ }

  // ── Check per-user cache (auth users only) ────────────────────────────────
  if (uid) {
    try {
      const snap   = await adminDb.collection("userIndex").doc(uid).get();
      const cached = (snap.data() ?? {}).localBrief as Record<string, unknown> | undefined;
      const paras  = Array.isArray(cached?.paragraphs) ? (cached!.paragraphs as string[]) : [];
      const images = Array.isArray(cached?.images)     ? (cached!.images     as string[]) : [];
      if (
        paras.length > 0 &&
        images.length > 0 &&
        (cached?.city as string | undefined)?.toLowerCase() === city.toLowerCase() &&
        cached?.fetchedAt &&
        Date.now() - (cached.fetchedAt as { toMillis: () => number }).toMillis() < CACHE_TTL_MS
      ) {
        return Response.json({ city: cached.city, paragraphs: paras, images, links: [], cached: true });
      }
    } catch { /* proceed to fresh fetch */ }
  }

  // ── Fetch top 4 city images (cached 30 days in cityIndex) ─────────────────
  const images = await getCityImages(city, docKey);

  // ── Generate 4 journalist paragraphs via Gemini ───────────────────────────
  let paragraphs: string[] = [];

  const JOURNALIST_PROMPT = `You are a sharp investigative journalist writing about cities for a prestige travel magazine. Your prose is vivid, sensory, and immersive — but every paragraph carries a quiet undercurrent of cause: the social shifts, economic forces, or environmental pressures that are quietly reshaping the place. You never preach or moralize. You let the details do the work.

Write exactly 4 paragraphs about ${city}. Each paragraph should be 80–110 words. Use second person, present tense. Separate each paragraph with a single blank line. No headers, no bullet points, no source citations.

The four paragraphs should form a connected portrait:
1. Arrival and the city's immediate atmosphere — what you sense the moment you land or step off the train.
2. The neighbourhoods and the people in them — who lives here, what's changing, what remains.
3. The food, drink, and cultural scene — where the city's identity is being made and contested right now.
4. The undercurrent — told subtly through a detail, a contrast, or a quiet observation that reveals the deeper force at work.`;

  try {
    const result = await ai.generate({
      model:  "googleai/gemini-2.0-flash-lite",
      prompt: JOURNALIST_PROMPT,
    });

    const raw = (result.text ?? "").trim();
    paragraphs = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(0, 4);

    while (paragraphs.length < 4) {
      paragraphs.push(`${city} continues to reveal itself in layers. Every return uncovers something the first visit missed.`);
    }
  } catch (err) {
    console.warn("[local-brief] Gemini failed:", err);
    paragraphs = [
      `${city} hits you the moment you arrive — a city that doesn't announce itself so much as absorb you into its particular rhythm.`,
      `The neighbourhoods each carry their own frequency: some polished, some quietly fraying at the edges, all unmistakably alive.`,
      `The food scene is where ${city} tells its truest story — not on the tourist menus but in the places locals pretend not to have discovered yet.`,
      `Something is shifting here. You can feel it in the rents, in the new signs above old shopfronts, in who is walking where and who no longer is.`,
    ];
  }

  // ── Persist to cityIndex (shared, fire-and-forget) ────────────────────────
  cityRef.set(
    { brief: { paragraphs, images, briefFetchedAt: FieldValue.serverTimestamp() } },
    { merge: true }
  ).catch((e: unknown) => console.warn("[local-brief] cityIndex write failed:", e));

  // ── Persist to userIndex (auth users only, fire-and-forget) ──────────────
  if (uid) {
    adminDb.collection("userIndex").doc(uid).set(
      { localBrief: { city, paragraphs, images, links: [], fetchedAt: FieldValue.serverTimestamp() } },
      { merge: true }
    ).catch((e: unknown) => console.warn("[local-brief] userIndex write failed:", e));
  }

  return Response.json({ city, paragraphs, images, links: [] } as LocalBriefPayload);
}
