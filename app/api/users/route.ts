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

  // Pull Google identity if present in the token
  const googleIdentities = decoded.firebase?.identities?.["google.com"] as string[] | undefined;
  const googleUid = googleIdentities?.[0] ?? null;

  // Prefer values passed explicitly from the client (auth.currentUser) over
  // token claims — Firebase doesn't always populate picture/email claims
  // immediately after linkWithPopup.
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
  } else if (googleUid) {
    // Existing user just linked Google — patch the new fields
    await ref.update({
      googleUid,
      email: resolvedEmail,
      photoURL: resolvedPhotoURL,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({ ok: true });
}
