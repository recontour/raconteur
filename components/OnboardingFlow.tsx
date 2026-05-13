"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  onAuthStateChanged,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { executeRecaptcha } from "@/lib/recaptcha";

import { type Step } from "./onboarding/shared";
import { useKeyboardOffset } from "./onboarding/BottomCTA";
import { StepWelcome } from "./onboarding/StepWelcome";
import { StepName } from "./onboarding/StepName";
import { StepPhone } from "./onboarding/StepPhone";
import { StepOtp } from "./onboarding/StepOtp";
import { StepTerms } from "./onboarding/StepTerms";
import { StepGoogle } from "./onboarding/StepGoogle";
import { GoogleAccountSheet } from "./onboarding/GoogleAccountSheet";

import { StepNameConflict } from "./onboarding/StepNameConflict";

const inputCls =
  "w-full px-4 py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black text-black text-lg shadow-sm transition-all placeholder:text-gray-400";

// ---------------------------------------------------------------------------
export default function OnboardingFlow() {
  const [step, setStep]           = useState<Step>(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Name
  const [firstName, setFirstName]       = useState("");
  const [lastName, setLastName]         = useState("");
  const [showLastName, setShowLastName] = useState(false);

  // Phone
  const [phone, setPhone]               = useState<string[]>(Array(10).fill(""));
  const [focusedPhone, setFocusedPhone] = useState<number | null>(null);

  // OTP
  const [otp, setOtp]                   = useState(["", "", "", "", "", ""]);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [focusedOtp, setFocusedOtp]     = useState<number | null>(null);

  // Loading / error states
  const [sendingOtp, setSendingOtp]     = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError]         = useState("");

  const [showGoogleSheet, setShowGoogleSheet] = useState(false);
  const [googleUserData, setGoogleUserData] = useState<{photoURL: string | null, email: string | null, googleName: string} | null>(null);

  const recaptchaRef         = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const keyboardOffset       = useKeyboardOffset();
  const router               = useRouter();

  // â”€â”€ On mount: resume session if already authenticated â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub(); // one-shot â€” never intercept later auth changes in this flow
      if (!u) return;
      const hasGoogle = u.providerData.some((p) => p.providerId === "google.com");
      if (hasGoogle) {
        router.replace("/welcome");
      } else {
        setDirection(1);
        setStep(5);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // â”€â”€ Save user to DB â€” called ONCE after Google is resolved â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Reads photoURL/email directly from auth.currentUser (populated after reload)
  const saveUser = useCallback(async (overrides?: { photoURL: string | null; email: string | null; firstName?: string; lastName?: string }) => {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken(true);
    // For phone-primary accounts Firebase does NOT auto-promote the linked
    // Google provider's photoURL/email to the user-level fields — they remain
    // null even after reload(). Fall back to providerData, then to overrides
    // captured directly from the OAuth result (most reliable).
    const googlePD = user.providerData.find((p) => p.providerId === "google.com");
    const photoURL = overrides?.photoURL ?? user.photoURL ?? googlePD?.photoURL ?? null;
    const email    = overrides?.email    ?? user.email    ?? googlePD?.email    ?? null;
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        photoURL,
        email,
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

  // â”€â”€ Send OTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendOtp = async () => {
    if (sendingOtp) return;
    setSendingOtp(true);
    setOtpError("");

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
      console.warn("[recaptcha] verification request failed, continuing:", err);
    }

    try {
      recaptchaVerifierRef.current?.clear();
    } catch {}
    recaptchaVerifierRef.current = null;
    if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";

    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        recaptchaRef.current!,
        { size: "invisible" }
      );
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
      try { recaptchaVerifierRef.current?.clear(); } catch {}
      recaptchaVerifierRef.current = null;
      if (recaptchaRef.current) recaptchaRef.current.innerHTML = "";
    } finally {
      setSendingOtp(false);
    }
  };

  // â”€â”€ Verify OTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const verifyOtp = async () => {
    if (verifyingOtp || !confirmation) return;
    const code = otp.join("");
    if (code.length < 6) return;
    setVerifyingOtp(true);
    setOtpError("");
    try {
      const cred = await confirmation.confirm(code);
      try { await saveUser(); } catch (err) { console.warn('Early saveUser failed', err); }
      const isNew = cred.user.metadata.creationTime === cred.user.metadata.lastSignInTime;
      if (isNew) {
        goTo(4); // new user â†’ terms
      } else {
        goTo(5); // returning user â†’ Google connect
      }
    } catch {
      setOtpError("Incorrect code. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // â”€â”€ Progress bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderProgress = () => {
    if (step === 0) return null;
    return (
      <div className="fixed top-12 left-0 right-0 flex justify-center gap-1.5 z-50">
        {Array.from({ length: 5 }).map((_, i) => {
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

   const screens: Record<Step, () => React.ReactNode> = {
    0: () => <StepWelcome onStart={() => goTo(1)} />,
    1: () => (
      <StepName
        firstName={firstName} setFirstName={setFirstName}
        lastName={lastName} setLastName={setLastName}
        showLastName={showLastName} setShowLastName={setShowLastName}
        keyboardOffset={keyboardOffset}
        onContinue={() => goTo(2)}
        inputCls={inputCls}
      />
    ),
    2: () => (
      <StepPhone
        phone={phone} setPhone={setPhone}
        focusedPhone={focusedPhone} setFocusedPhone={setFocusedPhone}
        otpError={otpError}
        sendingOtp={sendingOtp}
        keyboardOffset={keyboardOffset}
        onSend={sendOtp}
        onBack={() => goTo(1)}
        recaptchaRef={recaptchaRef}
      />
    ),
    3: () => (
      <StepOtp
        otp={otp} setOtp={setOtp}
        phone={phone}
        focusedOtp={focusedOtp} setFocusedOtp={setFocusedOtp}
        otpError={otpError}
        verifyingOtp={verifyingOtp}
        sendingOtp={sendingOtp}
        keyboardOffset={keyboardOffset}
        onVerify={verifyOtp}
        onResend={sendOtp}
        onBack={() => goTo(2)}
      />
    ),
    4: () => (
      <StepTerms
        onAgree={() => goTo(5)}
        onBack={() => goTo(3)}
      />
    ),
    5: () => (
      <StepGoogle
        onConnect={() => setShowGoogleSheet(true)}
        onSkip={async () => {
          await saveUser();
          router.push("/welcome");
        }}
      />
    ),
    6: () => (
      <StepNameConflict
        enteredName={`${firstName.trim()} ${lastName.trim()}`.trim()}
        googleName={googleUserData?.googleName || ""}
        keyboardOffset={keyboardOffset}
        onSelect={async (chosenName: string) => {
          const parts = chosenName.trim().split(" ");
          const fName = parts[0] || "";
          const lName = parts.slice(1).join(" ") || "";
          setFirstName(fName);
          setLastName(lName);
          await saveUser({ 
            photoURL: googleUserData?.photoURL ?? null, 
            email: googleUserData?.email ?? null, 
            firstName: fName, 
            lastName: lName 
          });
          router.push("/welcome");
        }}
      />
    ),
  };

  return (
    <div
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col overflow-hidden relative"
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
        onSuccess={async (photoURL, email) => {
          setShowGoogleSheet(false);
          await saveUser({ photoURL, email });
          router.push("/welcome");
        }}
      />
    </div>
  );
}


