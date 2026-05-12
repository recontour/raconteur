import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/users/link-google
 *
 * Called when a phone-auth user's linkWithPopup() fails with
 * auth/credential-already-in-use because the Google account already has its
 * own Firebase UID (uid_B).  This endpoint:
 *   1. Verifies the phone user's token (Authorization header) → uid_A
 *   2. Looks up uid_B via adminAuth.getUserByEmail(googleEmail)
 *   3. Links Google provider to uid_A   (Admin SDK providerToLink)
 *   4. Deletes uid_B                    (orphan Google-only account)
 *   5. Updates Firestore for uid_A; removes uid_B's doc
 *
 * Body:    { googleProviderUid: string }  — the Google OAuth "sub" (stable Google UID)
 * Headers: Authorization: Bearer <phoneUserIdToken>
 */
export async function POST(req: NextRequest) {
  // ── 1. Verify phone user token ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const phoneIdToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!phoneIdToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let phoneDecoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    phoneDecoded = await adminAuth.verifyIdToken(phoneIdToken);
  } catch {
    return NextResponse.json({ error: "Invalid phone token" }, { status: 401 });
  }

  const uidA = phoneDecoded.uid;

  // ── 2. Verify Google token ───────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { googleProviderUid?: string };
  const { googleProviderUid } = body;

  if (!googleProviderUid) {
    return NextResponse.json({ error: "Missing googleProviderUid" }, { status: 400 });
  }

  // ── 3. Look up uid_B by Google provider UID ───────────────────────────────
  let userB: Awaited<ReturnType<typeof adminAuth.getUser>>;
  try {
    const result = await adminAuth.getUsers([{ providerId: "google.com", providerUid: googleProviderUid }]);
    if (result.users.length === 0) {
      return NextResponse.json({ error: "Google account not found" }, { status: 404 });
    }
    userB = result.users[0];
  } catch {
    return NextResponse.json({ error: "Google account not found" }, { status: 404 });
  }

  const uidB = userB.uid;

  const googleProvider = userB.providerData.find((p) => p.providerId === "google.com");
  if (!googleProvider) {
    return NextResponse.json({ error: "Google provider not found on account" }, { status: 400 });
  }

  // ── 4. Fetch uid_A to check if Google is already linked ─────────────────
  let userA: Awaited<ReturnType<typeof adminAuth.getUser>>;
  try {
    userA = await adminAuth.getUser(uidA);
  } catch {
    return NextResponse.json({ error: "Phone account not found" }, { status: 404 });
  }

  const alreadyLinked = userA.providerData.some(
    (p) => p.providerId === "google.com" && p.uid === googleProvider.uid
  );

  if (uidA === uidB || alreadyLinked) {
    // Already merged — just make sure Firestore is up to date
  } else {
    // ── 5. Unlink Google from uid_B first (required before re-linking) ──────
    try {
      await adminAuth.updateUser(uidB, { providersToUnlink: ["google.com"] });
    } catch (err) {
      console.error("[link-google] unlink from uid_B failed:", err);
      return NextResponse.json({ error: "Failed to unlink Google from orphan account" }, { status: 500 });
    }

    // ── 6. Link Google to uid_A ──────────────────────────────────────────────
    try {
      await adminAuth.updateUser(uidA, {
        providerToLink: {
          providerId: "google.com",
          uid: googleProvider.uid,
          email: userB.email ?? googleProvider.email,
          displayName: userB.displayName ?? googleProvider.displayName,
          photoURL: userB.photoURL ?? googleProvider.photoURL,
        },
      });
    } catch (err) {
      console.error("[link-google] providerToLink failed:", err);
      return NextResponse.json({ error: "Failed to link Google account" }, { status: 500 });
    }

    // ── 7. Delete orphan uid_B from Auth ────────────────────────────────────
    try {
      await adminAuth.deleteUser(uidB);
    } catch (err) {
      console.warn("[link-google] deleteUser uid_B failed (non-fatal):", err);
    }

    // ── 8. Remove uid_B's Firestore doc if it exists ─────────────────────────
    const refB = adminDb.collection("users").doc(uidB);
    const snapB = await refB.get();
    if (snapB.exists) {
      await refB.delete();
    }
  }

  // ── 9. Upsert Firestore for uid_A (phone-first, merge Google fields) ──────
  const refA = adminDb.collection("users").doc(uidA);
  await refA.set(
    {
      googleUid: googleProvider.uid,
      email: userB.email ?? googleProvider.email ?? null,
      photoURL: userB.photoURL ?? googleProvider.photoURL ?? null,
      phone: userA.phoneNumber ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
