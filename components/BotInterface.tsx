"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./BotInterface.module.css";
import { useRouter } from "next/navigation";
// Open-Meteo is used for weather (free, no API key required)
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
import { doc, getDoc, setDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { writeRagData } from "@/components/RAGdata";

// ── Auth step types ────────────────────────────────────────────────────────
type AuthStep =
  | "method"
  | "phone-entry"
  | "phone-otp"
  | "profile-name"
  | "link-google"
  | "entering"
  | null;

// ── Dialogue types & constants ───────────────────────────────────────────────
interface DialogueStep {
  id: string;
  ai: string;
  options: string[];
  type: "row" | "grid";
}

const FLOW_ID = "main";

const WELCOME_STEP: DialogueStep = {
  id: "welcome",
  ai: "Welcome to Raconteur. What would you like to do today?",
  options: ["Continue Reading", "Start a New Story"],
  type: "grid",
};

const HERO_STEP: DialogueStep = {
  id: "hero",
  ai: "Every story needs a hero.",
  options: ["🌤 Weather near me", "Create avatar"],
  type: "row",
};

const AVATAR_STEP: DialogueStep = {
  id: "avatar",
  ai: "Choose your avatar:",
  options: [
    "Sir Fluffington",
    "Captain Chuckle",
    "Count Quackula",
    "Baron Von Bop",
    "Professor Puddle",
    "Lord Wiggles",
    "Doctor Doofus",
    "Madam Mischief",
    "Cancel"
  ],
  type: "grid",
};

const weatherDescription = (code: number): string => {
  if (code === 0)  return "☀️ Clear sky";
  if (code <= 3)   return "⛅ Partly cloudy";
  if (code <= 49)  return "🌫️ Fog";
  if (code <= 59)  return "🌦️ Drizzle";
  if (code <= 69)  return "🌧️ Rain";
  if (code <= 79)  return "❄️ Snow";
  if (code <= 82)  return "🌧️ Rain showers";
  if (code <= 84)  return "🌨️ Snow showers";
  if (code <= 99)  return "⛈️ Thunderstorm";
  return "☁️ Overcast";
};

const DEFAULT_FLOW_STEPS: DialogueStep[] = [
  {
    id: "genre",
    ai: "What do you want your next story to be?",
    options: ["Science Fiction", "High Fantasy", "Cyberpunk", "Mystery Thriller", "Historical Fiction", "Horror"],
    type: "grid",
  },
  {
    id: "choice",
    ai: "The world takes shape around you based on your chosen path. The air is thick with anticipation. Two paths lay before you.",
    options: ["Venture boldly forward", "Carefully observe your surroundings"],
    type: "row",
  },
];

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

  // Weather state
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);

  // Writer / flow state
  const [flowSteps, setFlowSteps] = useState<DialogueStep[]>(DEFAULT_FLOW_STEPS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [editableSteps, setEditableSteps] = useState<DialogueStep[]>([]);
  const [writerSaving, setWriterSaving] = useState(false);

  // ── Weather helper ───────────────────────────────────────────────────────
  const handleWeatherClick = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      setWeatherMessage("Geolocation isn't supported by your browser.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
          );
          const data = await res.json();
          const temp = Math.round(data.current.temperature_2m as number);
          const code = data.current.weather_code as number;
          const wind = Math.round(data.current.wind_speed_10m as number);
          setWeatherMessage(`${weatherDescription(code)}  ·  ${temp}°C  ·  Wind ${wind} km/h`);
        } catch {
          setWeatherMessage("Couldn't fetch weather right now. Try again later.");
        }
        setLoading(false);
      },
      () => {
        setWeatherMessage("Location access was denied. Please allow it in your browser.");
        setLoading(false);
      },
      { timeout: 10000 }
    );
  };

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

  // ── Flow loading & admin check ─────────────────────────────────────────
  useEffect(() => {
    if (authStateLoading || !user) return;
    const initialize = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().isAdmin === true) setIsAdmin(true);

      const flowDoc = await getDoc(doc(db, "dialogueFlows", FLOW_ID));
      if (flowDoc.exists()) {
        const data = flowDoc.data();
        if (Array.isArray(data.steps) && data.steps.length > 0) {
          setFlowSteps(data.steps as DialogueStep[]);
        }
      }
    };
    initialize();
  }, [user, authStateLoading]);

  // ── Save user choice to Firestore ──────────────────────────────────────
  const saveUserChoice = async (stepId: string, option: string) => {
    if (!auth.currentUser) return;
    await setDoc(doc(db, "userSessions", auth.currentUser.uid), {
      flowId: FLOW_ID,
      history: arrayUnion({ stepId, option, timestamp: new Date().toISOString() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  // ── Writer mode helpers ───────────────────────────────────────────────────
  const openWriterMode = () => {
    setEditableSteps(JSON.parse(JSON.stringify(flowSteps)));
    setWriterOpen(true);
  };

  const handleSaveFlow = async () => {
    if (!isAdmin || writerSaving) return;
    setWriterSaving(true);
    try {
      await setDoc(doc(db, "dialogueFlows", FLOW_ID), {
        steps: editableSteps,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid,
      }, { merge: true });
      setFlowSteps(editableSteps);
      setWriterOpen(false);
    } finally {
      setWriterSaving(false);
    }
  };

  const updateStep = (idx: number, updates: Partial<DialogueStep>) =>
    setEditableSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));

  const updateOption = (si: number, oi: number, val: string) =>
    setEditableSteps(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const opts = [...s.options]; opts[oi] = val; return { ...s, options: opts };
    }));

  const addOption = (si: number) =>
    setEditableSteps(prev => prev.map((s, i) =>
      i === si ? { ...s, options: [...s.options, ""] } : s
    ));

  const removeOption = (si: number, oi: number) =>
    setEditableSteps(prev => prev.map((s, i) =>
      i === si ? { ...s, options: s.options.filter((_, j) => j !== oi) } : s
    ));

  const addStep = () =>
    setEditableSteps(prev => [...prev, {
      id: `step_${Date.now()}`,
      ai: "",
      options: [""],
      type: "row" as const,
    }]);

  const removeStep = (idx: number) =>
    setEditableSteps(prev => prev.filter((_, i) => i !== idx));

  // ── Story dialogue ───────────────────────────────────────────────────────
  // Step 0 is always the welcome/routing step (hardcoded).
  // Steps -1 and -2 are new flow steps before starting a new story
  // Steps 1+ map to flowSteps[step - 1] fetched from Firestore.
  let currentDialogue = WELCOME_STEP;
  if (step === 0) currentDialogue = WELCOME_STEP;
  else if (step === -1) currentDialogue = HERO_STEP;
  else if (step === -2) currentDialogue = AVATAR_STEP;
  else currentDialogue = flowSteps[step - 1] ?? WELCOME_STEP;

  // When weather has been fetched, swap the AI message and collapse back to 2 options
  const displayDialogue = (weatherMessage && step === -1)
    ? { ...HERO_STEP, ai: weatherMessage, options: ["🌤 Weather near me", "Create avatar"], type: "row" as const }
    : currentDialogue;

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
        if (user) { router.push("/book"); return; }
        setAuthStep("method");
        return;
      }
      if (option === "Start a New Story") {
        setLoading(true);
        setTimeout(() => transitionToStep(-1), 800);
        return;
      }
    }

    if (step === -1) {
      if (option === "🌤 Weather near me") {
        handleWeatherClick();
        return;
      }
      if (option === "Create avatar") {
        setLoading(true);
        setTimeout(() => transitionToStep(-2), 800);
        return;
      }
    }

    if (step === -2) {
      if (option === "Cancel") {
        setLoading(true);
        setTimeout(() => transitionToStep(-1), 800);
        return;
      }

      setLoading(true);
      setIsSubmitting(true);

      // Save avatar selection using RAGdata
      if (auth.currentUser) {
        await writeRagData(auth.currentUser.uid, "avatar_selection", { avatar: option });
      }

      // Append to local RAG context
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `Selected Avatar: ${option}`,
        metadata: { source: `Avatar Creation`, type: "Avatar Choice" },
        score: 1.0,
      };
      setRagContext(prev => [newContextDoc, ...prev]);

      setIsSubmitting(false);
      setTimeout(() => transitionToStep(1), 800);
      return;
    }

    // Story flow — steps 1+ are dynamic from Firestore
    if (step >= 1) {
      const flowStepIndex = step - 1;
      const currentFlowStep = flowSteps[flowStepIndex];
      setLoading(true);
      setIsSubmitting(true);

      // Persist choice to Firestore
      await saveUserChoice(currentFlowStep.id, option);

      // Append to local RAG context
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `[${currentFlowStep.ai}] → ${option}`,
        metadata: { source: `dialogueFlows/${FLOW_ID}`, type: "Story Choice", stepId: currentFlowStep.id },
        score: 1.0,
      };
      setRagContext(prev => [newContextDoc, ...prev]);
      setIsSubmitting(false);

      // Advance to next step, or hold on last
      const nextIdx = flowStepIndex + 1;
      if (nextIdx < flowSteps.length) {
        transitionToStep(step + 1);
      } else {
        transitionToStep(step);
      }
      return;
    }
  };

  // ── Writer mode (admin only) ─────────────────────────────────────────────
  const renderWriterMode = () => {
    if (!writerOpen) return null;
    return (
      <div className={styles.writerOverlay}>
        <div className={styles.writerPanel}>

          <div className={styles.writerHeader}>
            <span className={styles.writerTitle}>Writer Mode</span>
            <div className={styles.writerHeaderActions}>
              <button className={styles.writerSaveBtn} onClick={handleSaveFlow} disabled={writerSaving}>
                {writerSaving ? "Saving…" : "Save Flow"}
              </button>
              <button className={styles.writerCloseBtn} onClick={() => setWriterOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>

          <div className={styles.writerStepList}>
            {editableSteps.map((s, si) => (
              <div key={s.id} className={styles.writerStepCard}>

                <div className={styles.writerStepMeta}>
                  <span className={styles.writerStepNum}>Step {si + 1}</span>
                  <div className={styles.writerTypeToggle}>
                    <button
                      className={`${styles.writerTypeBtn} ${s.type === "row" ? styles.writerTypeBtnActive : ""}`}
                      onClick={() => updateStep(si, { type: "row" })}
                    >Row</button>
                    <button
                      className={`${styles.writerTypeBtn} ${s.type === "grid" ? styles.writerTypeBtnActive : ""}`}
                      onClick={() => updateStep(si, { type: "grid" })}
                    >Grid</button>
                  </div>
                  <button
                    className={styles.writerDeleteStep}
                    onClick={() => removeStep(si)}
                    aria-label="Delete step"
                    disabled={editableSteps.length <= 1}
                  >✕</button>
                </div>

                <textarea
                  className={styles.writerAiTextarea}
                  value={s.ai}
                  onChange={e => updateStep(si, { ai: e.target.value })}
                  placeholder="AI message for this step…"
                  rows={3}
                />

                <div className={styles.writerOptions}>
                  {s.options.map((opt, oi) => (
                    <div key={oi} className={styles.writerOptionRow}>
                      <input
                        className={styles.writerOptionInput}
                        value={opt}
                        onChange={e => updateOption(si, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                      />
                      <button
                        className={styles.writerRemoveOption}
                        onClick={() => removeOption(si, oi)}
                        disabled={s.options.length <= 1}
                        aria-label="Remove option"
                      >−</button>
                    </div>
                  ))}
                  <button className={styles.writerAddOption} onClick={() => addOption(si)}>
                    + Option
                  </button>
                </div>

              </div>
            ))}
          </div>

          <button className={styles.writerAddStep} onClick={addStep}>
            + Add Step
          </button>

        </div>
      </div>
    );
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

      {/* Admin — writer mode trigger */}
      {isAdmin && !writerOpen && (
        <button className={styles.writerTrigger} onClick={openWriterMode} aria-label="Open Writer Mode">
          ✦ Writer
        </button>
      )}

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
              <div className={styles.textTransition} key={displayDialogue.ai}>
                {displayDialogue.ai}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bubbles */}
        <div className={displayDialogue.type === "grid" ? styles.optionsGrid : styles.optionsRow}>
          {displayDialogue.options.map((option, index) => (
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

      {/* Admin writer mode overlay */}
      {renderWriterMode()}
    </div>
  );
}
