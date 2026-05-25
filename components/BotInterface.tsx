"use client";

import React, { useState, useRef } from "react";
import styles from "./BotInterface.module.css";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/helper/auth";
import Context, { RagDocument } from "@/components/Context";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ── Auth step types ────────────────────────────────────────────────────────
type AuthStep =
  | "method"
  | "phone-entry"
  | "phone-otp"
  | "profile-name"
  | "link-google"
  | "entering"
  | null;

// ── Icons ──────────────────────────────────────────────────────────────────
const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.63A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function BotInterface() {
  const router = useRouter();
  const { user, loading: authStateLoading } = useAuth();

  // Story state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ragContext, setRagContext] = useState<RagDocument[]>([]);

  // Auth state
  const [authStep, setAuthStep] = useState<AuthStep>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authVia, setAuthVia] = useState<"phone" | "google" | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // ── reCAPTCHA helpers ────────────────────────────────────────────────────
  const clearVerifier = () => {
    try { recaptchaRef.current?.clear(); } catch { /* ignore */ }
    recaptchaRef.current = null;
  };

  const getVerifier = () => {
    clearVerifier();
    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    return recaptchaRef.current;
  };

  // ── Firestore helpers ────────────────────────────────────────────────────
  const checkIsNewUser = async (uid: string): Promise<boolean> => {
    const snap = await getDoc(doc(db, "users", uid));
    return !snap.exists();
  };

  const saveProfile = async (uid: string, data: Record<string, unknown>) => {
    await setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  };

  // ── Auth helpers ─────────────────────────────────────────────────────────
  const finalizeAuth = () => {
    setAuthStep("entering");
    setTimeout(() => router.push("/book"), 900);
  };

  const friendlyError = (msg: string): string => {
    if (msg.includes("invalid-phone-number")) return "Please enter a valid 10-digit number.";
    if (msg.includes("invalid-verification-code") || msg.includes("code-expired"))
      return "Incorrect or expired code. Try again.";
    if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment.";
    if (msg.includes("quota-exceeded")) return "SMS quota exceeded. Try again later.";
    return "Something went wrong. Please try again.";
  };

  // ── Phone OTP flow ───────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (phoneInput.length !== 10 || authBusy) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const verifier = getVerifier();
      const result = await signInWithPhoneNumber(auth, `+91${phoneInput}`, verifier);
      confirmationRef.current = result;
      setOtpInput("");
      setAuthStep("phone-otp");
    } catch (err) {
      setAuthError(friendlyError(err instanceof Error ? err.message : String(err)));
      clearVerifier();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpInput.length !== 6 || authBusy || !confirmationRef.current) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const result = await confirmationRef.current.confirm(otpInput);
      const newUser = await checkIsNewUser(result.user.uid);
      setAuthVia("phone");
      if (newUser) {
        setAuthStep("profile-name");
      } else {
        finalizeAuth();
      }
    } catch (err) {
      setAuthError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Google sign-in ───────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const newUser = await checkIsNewUser(result.user.uid);
      setAuthVia("google");
      if (newUser) {
        setAuthStep("profile-name");
      } else {
        finalizeAuth();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("popup-closed-by-user") && !msg.includes("cancelled-popup-request")) {
        setAuthError(friendlyError(msg));
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Profile name ─────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (nameInput.trim().length < 2 || authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await saveProfile(auth.currentUser.uid, {
        name: nameInput.trim(),
        createdAt: serverTimestamp(),
        authVia,
      });
      if (authVia === "phone") {
        setAuthStep("link-google");
      } else {
        finalizeAuth();
      }
    } catch (err) {
      setAuthError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Link Google to phone account ─────────────────────────────────────────
  const handleLinkGoogle = async () => {
    if (authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      await saveProfile(auth.currentUser.uid, { googleLinked: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // credential-already-in-use = Google account already linked — treat as success
      if (
        !msg.includes("popup-closed-by-user") &&
        !msg.includes("cancelled-popup-request") &&
        !msg.includes("credential-already-in-use")
      ) {
        setAuthError(friendlyError(msg));
        setAuthBusy(false);
        return;
      }
    } finally {
      setAuthBusy(false);
    }
    finalizeAuth();
  };

  // ── Story dialogue ───────────────────────────────────────────────────────
  const dialogue = [
    {
      ai: "Welcome to Raconteur. What would you like to do today?",
      options: ["Continue Reading", "Start a New Story"],
      type: "row",
    },
    {
      ai: "What do you want your next story to be?",
      options: ["Science Fiction", "High Fantasy", "Cyberpunk", "Mystery Thriller", "Historical Fiction", "Horror"],
      type: "grid",
    },
    {
      ai: "The world takes shape around you based on your chosen path. The air is thick with anticipation. Two paths lay before you.",
      options: ["Venture boldly forward", "Carefully observe your surroundings"],
      type: "row",
    },
  ];

  const currentDialogue = dialogue[step];

  const transitionToStep = (nextStep: number) => {
    setExiting(true);
    setTimeout(() => {
      setStep(nextStep);
      setExiting(false);
      setLoading(false);
    }, 300);
  };

  const handleOptionClick = async (option: string) => {
    if (loading || isSubmitting) return;

    if (step === 0) {
      if (option === "Continue Reading") {
        if (authStateLoading) return;
        if (user) {
          router.push("/book");
          return;
        }
        // Not authenticated — open inline auth panel
        setAuthStep("method");
        return;
      }
      if (option === "Start a New Story") {
        setLoading(true);
        setTimeout(() => transitionToStep(1), 800);
        return;
      }
    }

    if (step === 1) {
      setLoading(true);
      setIsSubmitting(true);
      console.log("Saving user genre choice to database...", option);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `The user requested a new story with the genre: ${option}`,
        metadata: { source: "User Preferences DB", type: "Genre Choice" },
        score: 1.0,
      };
      setRagContext(prev => [newContextDoc, ...prev]);
      setIsSubmitting(false);
      transitionToStep(2);
      return;
    }

    if (step === 2) {
      setLoading(true);
      setIsSubmitting(true);
      console.log("Saving user choice to database...", option);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `The user decided to: ${option}`,
        metadata: { source: "User History DB", type: "Choice" },
        score: 1.0,
      };
      setRagContext(prev => [newContextDoc, ...prev]);
      setIsSubmitting(false);
      transitionToStep(2);
      return;
    }
  };

  // ── Auth overlay ─────────────────────────────────────────────────────────
  const renderAuth = () => {
    if (!authStep) return null;

    return (
      <div className={styles.authOverlay}>
        {/* Invisible mount point required by Firebase RecaptchaVerifier */}
        <div id="recaptcha-container" style={{ position: "absolute", bottom: 0, opacity: 0, pointerEvents: "none" }} />

        <div className={styles.authPanel}>

          {/* ── Method selection ──────────────────────────────────────── */}
          {authStep === "method" && (
            <div className={styles.authContent}>
              <p className={styles.authWordmark}>Raconteur</p>
              <h2 className={styles.authTitle}>How would you like to sign in?</h2>
              <p className={styles.authSubtext}>Phone or Google — your choice. You can link both later.</p>
              <div className={styles.authMethods}>
                <button
                  className={styles.authMethodBtn}
                  onClick={() => { setAuthError(null); setPhoneInput(""); setAuthStep("phone-entry"); }}
                  disabled={authBusy}
                >
                  <PhoneIcon />
                  <span>Continue with Phone</span>
                </button>
                <button
                  className={styles.authMethodBtn}
                  onClick={handleGoogleSignIn}
                  disabled={authBusy}
                >
                  <GoogleIcon size={18} />
                  <span>Continue with Google</span>
                </button>
              </div>
              {authBusy && (
                <div className={styles.hiveLoader}>
                  <div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} />
                </div>
              )}
              {authError && <p className={styles.authError}>{authError}</p>}
              <button className={styles.authBack} onClick={() => { setAuthStep(null); setAuthError(null); }}>
                ← Back
              </button>
            </div>
          )}

          {/* ── Phone number entry ─────────────────────────────────────── */}
          {authStep === "phone-entry" && (
            <div className={styles.authContent}>
              <p className={styles.authWordmark}>Raconteur</p>
              <h2 className={styles.authTitle}>Enter your number</h2>
              <p className={styles.authSubtext}>We&apos;ll send a one-time code via SMS.</p>
              <div className={styles.phoneInputRow}>
                <span className={styles.countryCode}>+91</span>
                <input
                  className={styles.phoneInput}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  onKeyDown={e => e.key === "Enter" && handleSendOTP()}
                  autoFocus
                />
              </div>
              {authError && <p className={styles.authError}>{authError}</p>}
              <div className={styles.authActions}>
                <button className={styles.authGhostBtn} onClick={() => { setAuthStep("method"); setAuthError(null); }}>
                  Back
                </button>
                <button
                  className={styles.authPrimaryBtn}
                  onClick={handleSendOTP}
                  disabled={phoneInput.length !== 10 || authBusy}
                >
                  {authBusy ? <span className={styles.authSpinner} /> : "Send Code"}
                </button>
              </div>
            </div>
          )}

          {/* ── OTP verification ───────────────────────────────────────── */}
          {authStep === "phone-otp" && (
            <div className={styles.authContent}>
              <p className={styles.authWordmark}>Raconteur</p>
              <h2 className={styles.authTitle}>Enter the code</h2>
              <p className={styles.authSubtext}>Sent to +91&nbsp;{phoneInput}. Check your messages.</p>
              <input
                className={styles.otpInput}
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOTP()}
                autoFocus
              />
              {authError && <p className={styles.authError}>{authError}</p>}
              <div className={styles.authActions}>
                <button className={styles.authGhostBtn} onClick={() => { setAuthStep("phone-entry"); setAuthError(null); setOtpInput(""); }}>
                  Back
                </button>
                <button
                  className={styles.authPrimaryBtn}
                  onClick={handleVerifyOTP}
                  disabled={otpInput.length !== 6 || authBusy}
                >
                  {authBusy ? <span className={styles.authSpinner} /> : "Verify"}
                </button>
              </div>
            </div>
          )}

          {/* ── Profile name (new users only) ──────────────────────────── */}
          {authStep === "profile-name" && (
            <div className={styles.authContent}>
              <p className={styles.authWordmark}>Raconteur</p>
              <h2 className={styles.authTitle}>What shall we call you?</h2>
              <p className={styles.authSubtext}>Just a name — we&apos;ll remember it for next time.</p>
              <input
                className={styles.nameInput}
                type="text"
                placeholder="Your name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value.slice(0, 40))}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                autoFocus
              />
              {authError && <p className={styles.authError}>{authError}</p>}
              <div className={styles.authActions}>
                <button
                  className={styles.authPrimaryBtn}
                  style={{ flex: 1 }}
                  onClick={handleSaveName}
                  disabled={nameInput.trim().length < 2 || authBusy}
                >
                  {authBusy ? <span className={styles.authSpinner} /> : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* ── Link Google (phone users, optional) ───────────────────── */}
          {authStep === "link-google" && (
            <div className={styles.authContent}>
              <p className={styles.authWordmark}>Raconteur</p>
              <h2 className={styles.authTitle}>Link Google Account?</h2>
              <p className={styles.authSubtext}>
                Sign in faster next time with Google. You can always do this later.
              </p>
              {authError && <p className={styles.authError}>{authError}</p>}
              <div className={styles.authActions}>
                <button className={styles.authGhostBtn} onClick={finalizeAuth} disabled={authBusy}>
                  Skip
                </button>
                <button
                  className={styles.authPrimaryBtn}
                  onClick={handleLinkGoogle}
                  disabled={authBusy}
                >
                  {authBusy
                    ? <span className={styles.authSpinner} />
                    : <><GoogleIcon size={15} />&nbsp;Link Google</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── Entering — final loading before route push ─────────────── */}
          {authStep === "entering" && (
            <div className={`${styles.authContent} ${styles.authEntering}`}>
              <div className={styles.hiveLoader}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
              <p className={styles.authSubtext}>Entering your story…</p>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Raconteur</h1>
      </div>

      <div className={styles.layout}>
        {/* Top Bubble */}
        <div
          key={`top-${step}`}
          className={`${styles.topBubble} ${exiting ? styles.exiting : styles.enteringTop}`}
        >
          <div className={styles.blobContent}>
            {loading ? (
              <div className={styles.hiveLoader}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            ) : (
              <div className={styles.textTransition} key={currentDialogue.ai}>
                {currentDialogue.ai}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bubbles */}
        <div className={currentDialogue.type === "grid" ? styles.optionsGrid : styles.optionsRow}>
          {currentDialogue.options.map((option, index) => (
            <button
              key={`btn-${step}-${option}`}
              className={`${styles.bottomBubble} ${exiting ? styles.exiting : styles.enteringBottom}`}
              style={{ animationDelay: `${3 + index * 0.5}s` }}
              onClick={() => handleOptionClick(option)}
              disabled={loading || isSubmitting}
            >
              <div className={styles.textTransition} key={option}>
                {option}
              </div>
            </button>
          ))}
        </div>

        {/* RAG Context Display */}
        {ragContext.length > 0 && (
          <div className={styles.ragContainer}>
            <Context documents={ragContext} isLoading={isSubmitting} />
          </div>
        )}
      </div>

      {/* Inline auth overlay */}
      {renderAuth()}
    </div>
  );
}
