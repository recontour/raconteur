"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  onAuthStateChanged,
  User,
  type AuthError,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { executeRecaptcha } from "@/lib/recaptcha";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const slideVariants = {
  initial: { opacity: 0, x: 20 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account and using Raconteur, you confirm that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, you may not use the service.",
  },
  {
    title: "2. Use of the Service",
    body: "Raconteur grants you a limited, non-exclusive, non-transferable licence to use the app for personal, non-commercial purposes. You agree not to misuse, reverse-engineer, or attempt to compromise the security of the platform.",
  },
  {
    title: "3. User Content",
    body: "You retain ownership of all content you upload or create within Raconteur. By posting content, you grant us a worldwide, royalty-free licence to use, display, and distribute your content solely to operate the service.",
  },
  {
    title: "4. Privacy",
    body: "We collect only the information necessary to provide the service. Phone numbers are used exclusively for authentication. We do not sell your personal data to third parties. Please review our Privacy Policy for full details.",
  },
  {
    title: "5. Account Security",
    body: "You are responsible for maintaining the security of your account and all activity that occurs under it. Notify us immediately at security@raconteur.app if you suspect unauthorised access.",
  },
  {
    title: "6. Prohibited Conduct",
    body: "You agree not to use Raconteur to transmit illegal, harmful, abusive, or offensive content; to impersonate another person; or to interfere with the service's proper functioning.",
  },
  {
    title: "7. Termination",
    body: "We reserve the right to suspend or terminate your account at any time for violation of these terms, with or without notice. You may delete your account at any time from the settings menu.",
  },
  {
    title: "8. Changes to Terms",
    body: "We may update these Terms from time to time. Continued use of Raconteur after changes constitutes your acceptance. We will notify you of material changes via in-app notification.",
  },
  {
    title: "9. Limitation of Liability",
    body: "Raconteur is provided 'as is' without warranties of any kind. To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
  },
  {
    title: "10. Governing Law",
    body: "These Terms are governed by the laws of the jurisdiction in which Raconteur operates. Any disputes shall be resolved through binding arbitration, except where prohibited by law.",
  },
];

// ---------------------------------------------------------------------------
// Keyboard offset hook (iOS Visual Viewport API)
// ---------------------------------------------------------------------------
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const ua = navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    if (isAndroid) return; // dvh handles Android natively

    const update = () => {
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, kb));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}

// ---------------------------------------------------------------------------
// BottomCTA -- pins its children above the soft keyboard on iOS
// ---------------------------------------------------------------------------
function BottomCTA({
  offset,
  children,
}: {
  offset: number;
  children: React.ReactNode;
}) {
  const pb = offset > 0 ? offset + 16 : 32;
  return (
    <div
      style={{
        paddingBottom: pb,
        transition: "padding-bottom 220ms cubic-bezier(0.22,1,0.36,1)",
      }}
      className="w-full px-6"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------
const inputCls =
  "w-full px-4 py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-black text-lg shadow-sm transition-all placeholder:text-gray-400";

// ---------------------------------------------------------------------------
// GoogleAccountSheet — portal-rendered bottom sheet using Firebase signInWithPopup
// ---------------------------------------------------------------------------
function GoogleAccountSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      setSigningIn(false);
      setSheetError("");
    }
  }, [open]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setSheetError("");
    try {
      const provider = new GoogleAuthProvider();
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Link Google to the existing phone-auth account (same UID)
        await linkWithPopup(currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      onSuccess();
    } catch (err: unknown) {
      const code = (err && typeof err === "object" && "code" in err)
        ? (err as { code: string }).code
        : "";
      // Silently dismiss — user closed the popup themselves
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setSigningIn(false);
        return;
      }
      if (code === "auth/credential-already-in-use") {
        // The Google account already has its own Firebase UID (uid_B).
        // Use the server-side endpoint to link Google to the current phone user
        // (uid_A) and delete the orphan uid_B — without switching sessions here.
        // We pass the Google email so the server can look up uid_B via Admin SDK.
        const typedErr = err as AuthError & { customData?: { email?: string } };
        const googleEmail = typedErr.customData?.email;
        const phoneUser = auth.currentUser;
        if (googleEmail && phoneUser) {
          try {
            const phoneIdToken = await phoneUser.getIdToken();
            const res = await fetch("/api/users/link-google", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${phoneIdToken}`,
              },
              body: JSON.stringify({ googleEmail }),
            });
            if (res.ok) {
              // Force-refresh so the client token includes the newly linked Google provider
              await phoneUser.getIdToken(true);
              onSuccess();
              return;
            }
            const body = await res.json().catch(() => ({}));
            console.error("[Google sign-in] server-side link failed:", body);
            setSheetError("Failed to link your Google account. Please try again.");
          } catch (innerErr) {
            console.error("[Google sign-in] server-side link error:", innerErr);
            setSheetError("Failed to link your Google account. Please try again.");
          }
          setSigningIn(false);
          return;
        }
        setSheetError("This Google account is already linked to another user.");
      } else if (code === "auth/email-already-in-use") {
        setSheetError("This Google account is already linked to another user.");
      } else if (code === "auth/popup-blocked") {
        setSheetError("Popup was blocked. Please allow popups for this site.");
      } else {
        console.error("[Google sign-in] error code:", code, err);
        setSheetError(`Sign-in failed (${code || "unknown"}). Please try again.`);
      }
      setSigningIn(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.85 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.18)",
              paddingBottom: "env(safe-area-inset-bottom, 28px)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
            </div>

            {/* Google branding header */}
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                border: "1px solid #f0f0f0",
                background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 16, lineHeight: 1.3, margin: 0 }}>Sign in with Google</p>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>to continue to Raconteur</p>
              </div>
            </div>

            <div style={{ height: 1, background: "#f3f4f6", margin: "0 24px" }} />

            {/* CTA area */}
            <div style={{ padding: "24px 24px 8px" }}>
              {signingIn ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 8 }}
                >
                  <div style={{
                    width: 20, height: 20,
                    border: "2.5px solid #1d1d1f",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>Opening Google&hellip;</p>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                  onClick={handleSignIn}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "14px 20px",
                    background: "#fff",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 14,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 500,
                    color: "#1d1d1f",
                    fontFamily: "inherit",
                  }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, flexShrink: 0 }}>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </motion.button>
              )}
              {sheetError && (
                <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 12 }}>{sheetError}</p>
              )}
            </div>

            {/* Cancel */}
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "12px 32px",
                  fontSize: 15,
                  color: "#9ca3af",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ---------------------------------------------------------------------------
export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showLastName, setShowLastName] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);

  // Phone
  const [phone, setPhone] = useState<string[]>(Array(10).fill(""));
  const phoneRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedPhone, setFocusedPhone] = useState<number | null>(null);

  // OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [focusedOtp, setFocusedOtp] = useState<number | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const keyboardOffset = useKeyboardOffset();
  const [showGoogleSheet, setShowGoogleSheet] = useState(false);
  const router = useRouter();

  // On mount: if Firebase already has a session (e.g. after a page refresh),
  // resume at the correct step instead of showing step 0 again.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      // User is already authenticated — check if Google is linked
      const hasGoogle = u.providerData.some((p) => p.providerId === "google.com");
      if (hasGoogle) {
        // Fully set up — skip to welcome
        router.replace("/welcome");
      } else {
        // Phone auth done, Google not yet linked — jump to step 5
        setDirection(1);
        setStep(5);
      }
      unsub(); // only run once on mount
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveUserIfNew = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    // Force-refresh so the token includes any newly-linked provider (e.g. Google after linkWithPopup)
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Failed to save user");
    }
  }, [firstName, lastName]);

  const goTo = useCallback(
    (next: Step) => {
      setDirection(next > step ? 1 : -1);
      setStep(next);
    },
    [step]
  );

  // Focus name input on step 1
  useEffect(() => {
    if (step === 1) setTimeout(() => firstNameRef.current?.focus(), 300);
    if (step === 2) setTimeout(() => phoneRefs.current[0]?.focus(), 300);
    if (step === 3) setTimeout(() => otpRefs.current[0]?.focus(), 300);
  }, [step]);

  // ---------------------------------------------------------------------------
  // Firebase: send OTP
  // ---------------------------------------------------------------------------
  const sendOtp = async () => {
    if (sendingOtp) return;
    setSendingOtp(true);
    setOtpError("");

    // ── 1. reCAPTCHA Enterprise gate ────────────────────────────────────────
    let recaptchaToken: string;
    try {
      recaptchaToken = await executeRecaptcha("LOGIN");
    } catch (err) {
      console.error("[recaptcha] execute failed:", err);
      setOtpError("Security check failed. Please refresh and try again.");
      setSendingOtp(false);
      return;
    }

    try {
      const captchaRes = await fetch("/api/recaptcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: recaptchaToken,
          action: "LOGIN",
          phone: `+91${phone.join("")}`,
        }),
      });
      if (!captchaRes.ok) {
        const data = await captchaRes.json().catch(() => ({})) as { error?: string };
        setOtpError(data.error ?? "Security check failed. Please try again.");
        setSendingOtp(false);
        return;
      }
    } catch (err) {
      // Network error — fail-open so users aren't locked out
      console.warn("[recaptcha] verification request failed, continuing:", err);
    }

    // ── 2. Firebase phone auth (invisible RecaptchaVerifier) ────────────────
    // Always destroy any existing verifier — stale instances cause the
    // "Failed to initialize reCAPTCHA Enterprise" / stuck loop issue.
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {}
    recaptchaVerifierRef.current = null;

    // Wipe the container so reCAPTCHA can inject a fresh widget
    if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";

    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        recaptchaRef.current!,
        { size: "invisible" }
      );
      // Pre-render the widget before calling signInWithPhoneNumber
      await recaptchaVerifierRef.current.render();

      const result = await signInWithPhoneNumber(
        auth,
        `+91${phone.join("")}`,
        recaptchaVerifierRef.current
      );
      setConfirmation(result);
      goTo(3);
    } catch (err) {
      setOtpError("Failed to send code. Check your number and try again.");
      console.error(err);
      // Clean up on failure so the next attempt gets a fresh verifier
      try { recaptchaVerifierRef.current?.clear(); } catch {}
      recaptchaVerifierRef.current = null;
      if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";
    } finally {
      setSendingOtp(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Firebase: verify OTP
  // ---------------------------------------------------------------------------
  const verifyOtp = async () => {
    if (verifyingOtp || !confirmation) return;
    const code = otp.join("");
    if (code.length < 6) return;
    setVerifyingOtp(true);
    setOtpError("");
    try {
      const cred = await confirmation.confirm(code);
      // Create/upsert the user record immediately — name + phone are known now.
      // Google fields will be appended in step 5. Fire-and-forget; don't block navigation.
      void saveUserIfNew().catch(console.error);
      const isNew = cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime;
      if (isNew) {
        goTo(4); // show terms for new users
      } else {
        goTo(5); // existing user -> Google connect
      }
    } catch {
      setOtpError("Incorrect code. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };


  // ---------------------------------------------------------------------------
  // Progress bar (steps 1-5)
  // ---------------------------------------------------------------------------
  const renderProgress = () => {
    if (step === 0) return null;
    const total = 5;
    return (
      <div className="fixed top-12 left-0 right-0 flex justify-center gap-1.5 z-50">
        {Array.from({ length: total }).map((_, i) => {
          const idx = i + 1;
          let cls = "h-1 rounded-full transition-all duration-300 ";
          if (idx < step) cls += "w-6 bg-black/40";
          else if (idx === step) cls += "w-10 bg-black";
          else cls += "w-4 bg-gray-200";
          return <div key={i} className={cls} />;
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Screen 0 -- Welcome
  // ---------------------------------------------------------------------------
  const renderWelcome = () => (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center shadow-lg mb-2">
          <span style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif", fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1 }}>R</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-[#1d1d1f]">
          Welcome to<br />Raconteur.
        </h1>
        <p className="text-gray-500 text-lg leading-relaxed">
          Your personal storytelling companion. Let&apos;s get you set up.
        </p>
      </div>
      <BottomCTA offset={0}>
        <button
          onClick={() => goTo(1)}
          className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
        >
          Get Started
        </button>
      </BottomCTA>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen 1 -- Name
  // ---------------------------------------------------------------------------
  const renderName = () => (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            What&apos;s your name?
          </h2>
          <p className="text-gray-500 text-base">
            This is how you&apos;ll appear to your readers.
          </p>
        </div>

        <div className="space-y-3">
          <input
            ref={firstNameRef}
            type="text"
            placeholder="First name"
            value={firstName}
            autoComplete="given-name"
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstName.trim()) {
                if (showLastName) lastNameRef.current?.focus();
                else if (!showLastName) goTo(2);
              }
            }}
            className={inputCls}
          />

          {showLastName && (
            <input
              ref={lastNameRef}
              type="text"
              placeholder="Last name"
              value={lastName}
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstName.trim()) goTo(2);
              }}
              className={inputCls}
            />
          )}

          {!showLastName && (
            <button
              onClick={() => {
                setShowLastName(true);
                setTimeout(() => lastNameRef.current?.focus(), 260);
              }}
              className="text-[15px] text-gray-500 font-medium pl-1 active:opacity-50 transition-opacity"
            >
              + Add last name
            </button>
          )}
        </div>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <button
          onClick={() => goTo(2)}
          disabled={!firstName.trim()}
          className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 active:scale-[0.98] shadow-sm select-none transition-all"
        >
          Continue
        </button>
      </BottomCTA>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen 2 -- Phone
  // ---------------------------------------------------------------------------
  const renderPhone = () => (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
            +91 &middot; India
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Your phone number.
          </h2>
          <p className="text-gray-500 text-base">
            We&apos;ll send a one-time code to verify it&apos;s you.
          </p>
        </div>

        {/* 10-digit boxes, 2 rows of 5 */}
        <div className="flex flex-col gap-2">
          {([0, 5] as const).map((rowStart) => (
            <div key={rowStart} className="flex gap-2">
              {Array.from({ length: 5 }, (_, k) => rowStart + k).map((i) => (
                <div key={i} className="relative flex-1" style={{ height: 60 }}>
                  <motion.div
                    variants={{
                      empty:   { backgroundColor: "#f2f2f7", scale: 1 },
                      focused: { backgroundColor: "#e5e5ea", scale: 1 },
                      filled:  { backgroundColor: "#1d1d1f", scale: 1 },
                    }}
                    initial="empty"
                    animate={phone[i] ? "filled" : focusedPhone === i ? "focused" : "empty"}
                    transition={{ type: "spring", damping: 20, stiffness: 600 }}
                    className="absolute inset-0 rounded-xl"
                  />
                  <input
                    ref={(el) => { phoneRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={phone[i]}
                    onFocus={() => setFocusedPhone(i)}
                    onBlur={() => setFocusedPhone(null)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (!val) return;
                      const next = [...phone];
                      next[i] = val[val.length - 1];
                      setPhone(next);
                      if (i < 9) {
                        phoneRefs.current[i + 1]?.focus();
                      } else {
                        // All 10 digits filled — dismiss keyboard so Send Code button is visible
                        phoneRefs.current[9]?.blur();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        if (phone[i]) {
                          const next = [...phone];
                          next[i] = "";
                          setPhone(next);
                        } else if (i > 0) {
                          phoneRefs.current[i - 1]?.focus();
                        }
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10);
                      const next = Array(10).fill("") as string[];
                      pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
                      setPhone(next);
                      if (pasted.length >= 10) {
                        phoneRefs.current[9]?.blur();
                      } else {
                        phoneRefs.current[Math.min(pasted.length, 9)]?.focus();
                      }
                    }}
                    className="absolute inset-0 w-full h-full text-center text-xl font-semibold bg-transparent focus:outline-none"
                    style={{
                      color: phone[i] ? "#fff" : "#1d1d1f",
                      caretColor: "transparent",
                      zIndex: 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <AnimatePresence>
          {otpError && step === 2 && (
            <motion.p
              key="phone-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-red-500 text-sm"
            >
              {otpError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <div className="space-y-3">
          <motion.button
            onClick={sendOtp}
            disabled={phone.join("").length < 10 || sendingOtp}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 shadow-sm select-none transition-opacity"
          >
            {sendingOtp ? "Sending…" : "Send Code"}
          </motion.button>
          <button
            onClick={() => goTo(1)}
            className="w-full py-4 border border-gray-200 rounded-xl text-[#1d1d1f] font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>

      <div ref={recaptchaRef} />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen 3 -- OTP
  // ---------------------------------------------------------------------------
  const renderOtp = () => (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Enter the code.
          </h2>
          <p className="text-gray-500 text-base">
            Sent to +91&nbsp;{phone.join("")}
          </p>
        </div>

        <div className="flex gap-2.5">
          {otp.map((digit, i) => (
            <div key={i} className="relative flex-1" style={{ height: 62 }}>
              <motion.div
                variants={{
                  empty: { backgroundColor: "#f2f2f7", scale: 1 },
                  focused: { backgroundColor: "#e5e5ea", scale: 1 },
                  filled: { backgroundColor: "#1d1d1f", scale: 1 },
                }}
                initial="empty"
                animate={digit ? "filled" : focusedOtp === i ? "focused" : "empty"}
                transition={{ type: "spring", damping: 20, stiffness: 600 }}
                className="absolute inset-0 rounded-2xl"
              />
              <input
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onFocus={() => setFocusedOtp(i)}
                onBlur={() => setFocusedOtp(null)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (!val) return;
                  const next = [...otp];
                  next[i] = val[val.length - 1];
                  setOtp(next);
                  if (i < 5) {
                    otpRefs.current[i + 1]?.focus();
                  } else {
                    // Last digit — dismiss keyboard, then auto-verify
                    otpRefs.current[5]?.blur();
                    if (next.every((d) => d)) {
                      const full = next.join("");
                      if (full.length === 6) setTimeout(verifyOtp, 50);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    if (otp[i]) {
                      const next = [...otp];
                      next[i] = "";
                      setOtp(next);
                    } else if (i > 0) {
                      otpRefs.current[i - 1]?.focus();
                    }
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  const next = [...otp];
                  pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
                  setOtp(next);
                  if (pasted.length >= 6) {
                    otpRefs.current[5]?.blur();
                    setTimeout(verifyOtp, 50);
                  } else {
                    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
                  }
                }}
                className="absolute inset-0 w-full h-full text-center text-2xl font-semibold bg-transparent focus:outline-none"
                style={{
                  color: digit ? "#fff" : "#1d1d1f",
                  caretColor: "transparent",
                  zIndex: 1,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence>
          {otpError && (
            <motion.p
              key="otp-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="text-red-500 text-sm"
            >
              {otpError}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          onClick={sendOtp}
          disabled={sendingOtp}
          className="text-[15px] text-gray-400 font-medium active:opacity-50 transition-opacity self-start"
        >
          {sendingOtp ? "Resending…" : "Resend code"}
        </button>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <div className="space-y-3">
          <motion.button
            onClick={verifyOtp}
            disabled={otp.join("").length < 6 || verifyingOtp}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 shadow-sm select-none transition-opacity"
          >
            {verifyingOtp ? "Verifying…" : "Verify"}
          </motion.button>
          <button
            onClick={() => goTo(2)}
            className="w-full py-4 border border-gray-200 rounded-xl text-[#1d1d1f] font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen 4 -- Terms (new users only)
  // ---------------------------------------------------------------------------
  const renderTerms = () => (
    <div className="flex flex-col h-full w-full">
      <div className="flex-none px-6 pt-8 pb-4">
        <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          Terms &amp; Conditions
        </h2>
        <p className="text-gray-500 text-base mt-1">
          Please read and accept before continuing.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
        {TERMS_SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="font-semibold text-[#1d1d1f] mb-1">{s.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <BottomCTA offset={0}>
        <div className="space-y-3">
          <button
            onClick={() => goTo(5)}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
          >
            I Agree
          </button>
          <button
            onClick={() => goTo(3)}
            className="w-full py-4 border border-gray-300 rounded-xl text-black font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen 5 -- Connect Google
  // ---------------------------------------------------------------------------
  const renderGoogle = () => (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#F9F9F9] border border-gray-200 flex items-center justify-center shadow-sm mb-2">
          <svg viewBox="0 0 24 24" className="w-8 h-8">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          Connect Google.
        </h2>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs">
          Link your Google account for seamless sign-in and backup.
        </p>
      </div>

      <BottomCTA offset={0}>
        <div className="space-y-3">
          <button
            onClick={() => setShowGoogleSheet(true)}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
          >
            Connect with Google
          </button>
          <button
            onClick={async () => { await saveUserIfNew(); router.push("/welcome"); }}
            className="w-full py-4 text-gray-400 font-medium text-base active:opacity-50 transition-opacity"
          >
            Skip for now
          </button>
        </div>
      </BottomCTA>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Screen renderers map
  // ---------------------------------------------------------------------------
  const screens: Record<Step, () => React.ReactNode> = {
    0: renderWelcome,
    1: renderName,
    2: renderPhone,
    3: renderOtp,
    4: renderTerms,
    5: renderGoogle,
  };

  // ---------------------------------------------------------------------------
  // Root
  // ---------------------------------------------------------------------------
  return (
    <div
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col overflow-hidden relative"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {renderProgress()}

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={step}
          custom={direction}
          variants={{
            initial: (d: number) => ({ opacity: 0, x: d * 20 }),
            enter: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: d * -20 }),
          }}
          initial="initial"
          animate="enter"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          className="absolute inset-0 flex flex-col"
        >
          {screens[step]()}
        </motion.div>
      </AnimatePresence>

      <GoogleAccountSheet
        open={showGoogleSheet}
        onClose={() => setShowGoogleSheet(false)}
        onSuccess={async () => {
          setShowGoogleSheet(false);
          await saveUserIfNew();
          router.push("/welcome");
        }}
      />
    </div>
  );
}
