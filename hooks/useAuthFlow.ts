import { useState, useRef } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { checkUserStatus, saveUserProfile } from "@/app/actions/user";

export type AuthStep =
  | "method"
  | "phone-entry"
  | "phone-otp"
  | "profile-name"
  | "link-google"
  | "entering"
  | null;

export function useAuthFlow(onComplete: () => void) {
  const [authStep, setAuthStep] = useState<AuthStep>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authVia, setAuthVia] = useState<"phone" | "google" | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const clearVerifier = () => {
    try {
      recaptchaRef.current?.clear();
    } catch {
      /* ignore */
    }
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
      return "Cannot reach Firestore right now. Check your internet connection.";
    if (msg.includes("invalid-phone-number")) return "Please enter a valid 10-digit number.";
    if (msg.includes("invalid-verification-code") || msg.includes("code-expired"))
      return "Incorrect or expired code. Try again.";
    if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment.";
    if (msg.includes("quota-exceeded")) return "SMS quota exceeded. Try again later.";
    return "Something went wrong. Please try again.";
  };

  const checkIsNewUser = async (uid: string): Promise<boolean> => {
    try {
      const { exists } = await checkUserStatus(uid);
      return !exists;
    } catch (err) {
      console.error("Failed to check user status", err);
      // Fallback to true if server action fails (e.g. DB not found error)
      // but the error will still trigger the friendly error in the caller
      throw err;
    }
  };

  const saveProfile = async (uid: string, data: Record<string, unknown>) => {
    await saveUserProfile(uid, data);
  };

  const finalizeAuth = () => {
    setAuthStep("entering");
    setTimeout(() => {
      setAuthStep(null);
      onComplete();
    }, 900);
  };

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
      setAuthVia("phone");
      let isNew = false;
      try {
        isNew = await checkIsNewUser(result.user.uid);
      } catch {
        finalizeAuth();
        return;
      }
      if (isNew) {
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

  const handleGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      setAuthVia("google");
      // Status check is best-effort — if it fails the user is already signed in,
      // so proceed rather than surfacing a confusing error.
      let isNew = false;
      try {
        isNew = await checkIsNewUser(result.user.uid);
      } catch {
        finalizeAuth();
        return;
      }
      if (isNew) {
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

  const handleSaveName = async () => {
    if (nameInput.trim().length < 2 || authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await saveProfile(auth.currentUser.uid, {
        name: nameInput.trim(),
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

  const handleLinkGoogle = async () => {
    if (authBusy || !auth.currentUser) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      await saveProfile(auth.currentUser.uid, { googleLinked: true });
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
    handleGoogleSignIn,
    handleSaveName,
    handleLinkGoogle,
    finalizeAuth,
  };
}
