import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const MAX_PLACES = 5;

function cityKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function resolveUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return null;
  try {
    return (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return null;
  }
}

/** GET /api/users/places — returns the saved places map */
export async function GET(req: NextRequest) {
  const uid = await resolveUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("users").doc(uid).get();
  const places: Record<string, { name: string; addedAt: number }> =
    snap.exists ? (snap.data()?.places ?? {}) : {};

  return NextResponse.json({ places });
}

/**
 * POST /api/users/places
 * Body: { name: string }
 * Adds the city to the places map (max 5). If already at 5, evicts the
 * entry with the oldest addedAt timestamp before inserting.
 */
export async function POST(req: NextRequest) {
  const uid = await resolveUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { name?: unknown };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const name = body.name.trim();
  const key = cityKey(name);
  const now = Date.now();

  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();
  const existing: Record<string, { name: string; addedAt: number }> =
    snap.exists ? (snap.data()?.places ?? {}) : {};

  const updated = { ...existing, [key]: { name, addedAt: now } };

  // Evict oldest if over limit
  const entries = Object.entries(updated);
  if (entries.length > MAX_PLACES) {
    entries.sort((a, b) => a[1].addedAt - b[1].addedAt);
    const toEvict = entries.slice(0, entries.length - MAX_PLACES);
    for (const [k] of toEvict) delete updated[k];
  }

  await ref.set({ places: updated }, { merge: true });
  return NextResponse.json({ ok: true, places: updated });
}
