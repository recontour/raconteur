import { useState, useRef } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  linkWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveUserProfile, upsertPhoneUser, saveGoogleAuthLog } from "@/app/actions/user";

export type AuthStep =
  | "phone-entry"
  | "phone-otp"
  | "profile-name"
  | "link-google"
  | "entering"
  | null;

export function useAuthFlow(onComplete: () => void) {
  const [authStep,   setAuthStep]   = useState<AuthStep>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput,   setOtpInput]   = useState("");
  const [nameInput,  setNameInput]  = useState("");
  const [authError,  setAuthError]  = useState<string | null>(null);
  const [authBusy,   setAuthBusy]   = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef    = useRef<RecaptchaVerifier   | null>(null);

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

  const friendlyError = (msg: string): string => {
    if (msg.includes("client is offline") || msg.toLowerCase().includes("offline"))
      return "Cannot reach server. Check your connection.";
    if (msg.includes("invalid-phone-number"))
      return "Please enter a valid 10-digit number.";
    if (msg.includes("invalid-verification-code") || msg.includes("code-expired"))
      return "Incorrect or expired code. Try again.";
    if (msg.includes("too-many-requests"))
      return "Too many attempts. Please wait a moment.";
    if (msg.includes("quota-exceeded"))
      return "SMS quota exceeded. Try again later.";
    return "Something went wrong. Please try again.";
  };

  const finalizeAuth = () => {
    setAuthStep("entering");
    setTimeout(() => {
      setAuthStep(null);
      onComplete();
    }, 800);
  };

  const handleSendOTP = async () => {
    if (phoneInput.length !== 10 || authBusy) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const verifier = getVerifier();
      const result   = await signInWithPhoneNumber(auth, `+91${phoneInput}`, verifier);
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
      const uid    = result.user.uid;

      let name: string | null = null;
      try {
        const res = await upsertPhoneUser(uid, `+91${phoneInput}`);
        name = res.name;
      } catch {
        setAuthStep("profile-name");
        return;
      }

      if (name) {
        finalizeAuth();
      } else {
        setAuthStep("profile-name");
      }
    } catch (err) {
      setAuthError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveName = async () => {
    if (nameInput.trim().length < 2 || authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const parts = nameInput.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      await saveUserProfile(auth.currentUser.uid, {
        name:      nameInput.trim(),
        firstName,
        lastName:  parts.slice(1).join(" ") || "",
      });
      await updateProfile(auth.currentUser, { displayName: firstName });
      setAuthStep("link-google");
    } catch (err) {
      setAuthError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const cred = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      const g    = cred.user;
      const gProvider = g.providerData.find((p) => p.providerId === "google.com");
      await saveGoogleAuthLog(g.uid, {
        displayName: gProvider?.displayName ?? g.displayName,
        email:       gProvider?.email       ?? g.email,
        photoURL:    gProvider?.photoURL    ?? g.photoURL,
        providerId:  "google.com",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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

  return {
    authStep,
    setAuthStep,
    phoneInput,
    setPhoneInput,
    otpInput,
    setOtpInput,
    nameInput,
    setNameInput,
    authError,
    setAuthError,
    authBusy,
    handleSendOTP,
    handleVerifyOTP,
    handleSaveName,
    handleLinkGoogle,
    finalizeAuth,
  };
}
