// ---------------------------------------------------------------------------
// POST /api/recaptcha
// Verifies a reCAPTCHA Enterprise token via the Assessment API and optionally
// records the phone number in phone_signups once the check passes.
//
// Fail-open policy: infrastructure errors (misconfigured key, unreachable API)
// allow the request through with a warning. Only confirmed bot scores block.
//
// Required env vars (server-side):
//   RECAPTCHA_ENTERPRISE_API_KEY   — Google Cloud API key with
//                                    "reCAPTCHA Enterprise API" enabled
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const SCORE_THRESHOLD = 0.5;

interface RecaptchaAssessment {
  tokenProperties?: {
    valid: boolean;
    invalidReason?: string;
    action?: string;
  };
  riskAnalysis?: {
    score: number;
    reasons?: string[];
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// Write or update a phone_signups record (fire-and-forget friendly)
async function recordPhoneSignup(phone: string, score: number | null) {
  try {
    const safe = phone.replace(/[^+\d]/g, "");
    await adminDb.collection("phone_signups").doc(safe).set(
      {
        phone: safe,
        lastRequestAt: FieldValue.serverTimestamp(),
        lastRecaptchaScore: score,
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[recaptcha] Failed to write phone_signups:", err);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    token?: string;
    action?: string;
    phone?: string;
  };

  const { token, action, phone } = body;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;

  // ── Fail-open: env vars not configured ─────────────────────────────────
  if (!apiKey || !projectId || !siteKey) {
    console.warn("[recaptcha] Env vars not set — failing open");
    if (phone) await recordPhoneSignup(phone, null);
    return NextResponse.json({ ok: true, score: null, warn: "unconfigured" });
  }

  const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

  // ── Call Google Assessment API ─────────────────────────────────────────
  let httpOk = true;
  let assessment: RecaptchaAssessment = {};

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: { token, siteKey, expectedAction: action } }),
    });

    if (!res.ok) {
      // 403 = API key not enabled for reCAPTCHA Enterprise, etc.
      console.warn(`[recaptcha] Assessment API HTTP ${res.status} — failing open`);
      httpOk = false;
    } else {
      assessment = (await res.json()) as RecaptchaAssessment;
    }
  } catch (err) {
    console.warn("[recaptcha] Assessment API unreachable — failing open:", err);
    httpOk = false;
  }

  // ── Fail-open: any infrastructure / config error ───────────────────────
  if (!httpOk || assessment.error) {
    if (assessment.error) {
      console.warn("[recaptcha] Assessment body error — failing open:", assessment.error);
    }
    if (phone) await recordPhoneSignup(phone, null);
    return NextResponse.json({ ok: true, score: null, warn: "assessment_error" });
  }

  // ── Token validity — only hard block ──────────────────────────────────
  if (!assessment.tokenProperties?.valid) {
    return NextResponse.json(
      {
        error: "Invalid reCAPTCHA token",
        reason: assessment.tokenProperties?.invalidReason ?? "UNKNOWN",
      },
      { status: 403 }
    );
  }

  // ── Action mismatch ────────────────────────────────────────────────────
  if (action && assessment.tokenProperties.action !== action) {
    return NextResponse.json(
      { error: "reCAPTCHA action mismatch", expected: action, received: assessment.tokenProperties.action },
      { status: 403 }
    );
  }

  const score = assessment.riskAnalysis?.score ?? 0;
  const reasons = assessment.riskAnalysis?.reasons ?? [];

  // ── Low score — block ──────────────────────────────────────────────────
  if (score < SCORE_THRESHOLD) {
    console.warn(`[recaptcha] Low score ${score} for action "${action}":`, reasons);
    return NextResponse.json(
      { error: "Suspicious activity detected. Please try again.", score },
      { status: 403 }
    );
  }

  // ── All good ───────────────────────────────────────────────────────────
  if (phone) await recordPhoneSignup(phone, score);
  return NextResponse.json({ ok: true, score });
}
