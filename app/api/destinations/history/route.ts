import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

interface Resort {
  name: string;
  link?: string;
  price?: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
}

// GET → last 5 travel destination searches for the authenticated user
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return NextResponse.json({ history: [] });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ history: [] });
  }

  try {
    const snap = await adminDb
      .collection("travelLogs")
      .where("uid", "==", uid)
      .limit(20)
      .get();

    if (snap.empty) return NextResponse.json({ history: [] });

    // Sort in JS (avoids composite index requirement)
    const sorted = snap.docs
      .map((d) => d.data())
      .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));

    // Deduplicate by destination name, keep most recent per destination
    const seen = new Set<string>();
    const history = sorted
      .filter((d) => {
        const key = (d.destination as string ?? "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((d) => ({
        destination: d.destination as string,
        resorts: (d.resorts as Resort[] ?? []).slice(0, 4),
        timestamp: d.timestamp?.toMillis?.() ?? null,
      }));

    return NextResponse.json({ history });
  } catch (err) {
    console.error("[destinations/history GET]", err);
    return NextResponse.json({ history: [] });
  }
}
