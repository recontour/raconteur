import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { uid } = decoded;
  const body = await req.json().catch(() => ({}));
  const { firstName, lastName, photoURL: bodyPhotoURL, email: bodyEmail } =
    body as { firstName?: string; lastName?: string; photoURL?: string | null; email?: string | null };

  const googleIdentities = decoded.firebase?.identities?.["google.com"] as string[] | undefined;
  const googleUid = googleIdentities?.[0] ?? null;

  const resolvedEmail = bodyEmail ?? decoded.email ?? null;
  const resolvedPhotoURL = bodyPhotoURL ?? decoded.picture ?? null;

  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      uid,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      phone: decoded.phone_number ?? null,
      email: resolvedEmail,
      photoURL: resolvedPhotoURL,
      googleUid,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    const updateData: Record<string, any> = {};
    if (firstName !== undefined) updateData.firstName = firstName || null;
    if (lastName !== undefined) updateData.lastName = lastName || null;
    if (googleUid) updateData.googleUid = googleUid;
    if (resolvedEmail) updateData.email = resolvedEmail;
    if (resolvedPhotoURL) updateData.photoURL = resolvedPhotoURL;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = FieldValue.serverTimestamp();
      await ref.update(updateData);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    if (snap.exists) {
      return NextResponse.json({ user: snap.data() });
    }
    return NextResponse.json({ user: null });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
