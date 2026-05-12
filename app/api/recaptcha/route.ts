// ---------------------------------------------------------------------------
// POST /api/recaptcha
// Verifies a reCAPTCHA Enterprise token via the Assessment API.
//
// Required env vars (server-side only):
//   RECAPTCHA_ENTERPRISE_API_KEY   — Google Cloud API key with
//                                    "reCAPTCHA Enterprise API" enabled
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";

const SCORE_THRESHOLD = 0.5;

interface RecaptchaAssessment {
  name?: string;
  tokenProperties?: {
    valid: boolean;
    invalidReason?: string;
    hostname?: string;
    action?: string;
    createTime?: string;
  };
  riskAnalysis?: {
    score: number;
    reasons?: string[];
    extendedVerdictReasons?: string[];
  };
  event?: {
    token?: string;
    siteKey?: string;
    expectedAction?: string;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    token?: string;
    action?: string;
  };

  const { token, action } = body;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (!apiKey || !projectId || !siteKey) {
    console.error("[recaptcha] Missing server env vars");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const url =
    `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

  let assessment: RecaptchaAssessment;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          token,
          siteKey,
          expectedAction: action,
        },
      }),
    });
    assessment = (await res.json()) as RecaptchaAssessment;
  } catch (err) {
    console.error("[recaptcha] Assessment API unreachable:", err);
    return NextResponse.json({ error: "Verification request failed" }, { status: 502 });
  }

  // Google returned an API-level error
  if (assessment.error) {
    console.error("[recaptcha] Assessment API error:", assessment.error);
    return NextResponse.json(
      { error: assessment.error.message },
      { status: 502 }
    );
  }

  // Token integrity check
  if (!assessment.tokenProperties?.valid) {
    return NextResponse.json(
      {
        error: "Invalid reCAPTCHA token",
        reason: assessment.tokenProperties?.invalidReason ?? "UNKNOWN",
      },
      { status: 403 }
    );
  }

  // Action mismatch guard — prevents token reuse across different forms
  if (action && assessment.tokenProperties.action !== action) {
    return NextResponse.json(
      {
        error: "reCAPTCHA action mismatch",
        expected: action,
        received: assessment.tokenProperties.action,
      },
      { status: 403 }
    );
  }

  const score = assessment.riskAnalysis?.score ?? 0;
  const reasons = assessment.riskAnalysis?.reasons ?? [];

  if (score < SCORE_THRESHOLD) {
    console.warn(`[recaptcha] Low score ${score} for action "${action}":`, reasons);
    return NextResponse.json(
      { error: "Suspicious activity detected. Please try again.", score },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, score });
}
