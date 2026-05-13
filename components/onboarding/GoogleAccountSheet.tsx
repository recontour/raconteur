"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  reload,
  type AuthError,
} from "firebase/auth";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (photoURL: string | null, email: string | null, googleName?: string | null) => void;
}

export function GoogleAccountSheet({ open, onClose, onSuccess }: Props) {
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
        // Capture photo/email from the OAuth result BEFORE reload() â€” the result
        // has fresh Google profile data that reload() may not preserve.
        const result = await linkWithPopup(currentUser, provider);
        const gPD = result.user.providerData.find((p) => p.providerId === "google.com");
        const linkedPhoto = result.user.photoURL ?? gPD?.photoURL ?? null;
        const linkedEmail = result.user.email ?? gPD?.email ?? null;
        await reload(currentUser);
        onSuccess(linkedPhoto, linkedEmail);
      } else {
        const result = await signInWithPopup(auth, provider);
        const gPD = result.user.providerData.find((p) => p.providerId === "google.com");
        onSuccess(
          result.user.photoURL ?? gPD?.photoURL ?? null,
          result.user.email ?? gPD?.email ?? null,
          result.user.displayName ?? gPD?.displayName ?? null
        );
      }
    } catch (err: unknown) {
      const code = (err && typeof err === "object" && "code" in err)
        ? (err as { code: string }).code
        : "";

      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setSigningIn(false);
        return;
      }

      if (code === "auth/credential-already-in-use") {
        // The Google account already has its own Firebase UID (uid_B).
        // Use the server-side endpoint to link Google to the current phone user
        // (uid_A) and delete the orphan uid_B â€” without switching sessions here.
        // Decode the Google OAuth idToken JWT to get the stable Google UID (sub).
        const googleCredential = GoogleAuthProvider.credentialFromError(err as AuthError);
        const googleOAuthToken = googleCredential?.idToken;
        let googleProviderUid: string | undefined;
        let jwtPhoto: string | null = null;
        let jwtEmail: string | null = null;
          let jwtName: string | null = null;
        if (googleOAuthToken) {
          try {
            const payload = JSON.parse(atob(googleOAuthToken.split(".")[1]));
            googleProviderUid = payload.sub as string;
            // Also grab photo and email from the JWT â€” most reliable source here
            jwtPhoto = (payload.picture as string | undefined) ?? null;
            jwtEmail = (payload.email as string | undefined) ?? null;
            jwtName = (payload.name as string | undefined) ?? null;
          } catch { /* ignore decode errors */ }
        }
        const phoneUser = auth.currentUser;
        if (googleProviderUid && phoneUser) {
          try {
            const phoneIdToken = await phoneUser.getIdToken();
            const res = await fetch("/api/users/link-google", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${phoneIdToken}`,
              },
              body: JSON.stringify({ googleProviderUid }),
            });
            if (res.ok) {
              // Force-refresh so the client token includes the newly linked Google provider
              await phoneUser.getIdToken(true);
              await reload(phoneUser);
              // Use JWT-decoded values â€” most reliable for this code path
              onSuccess(jwtPhoto, jwtEmail, jwtName);
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.85 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 48px rgba(0,0,0,0.18)",
              paddingBottom: "env(safe-area-inset-bottom, 28px)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }} />
            </div>

            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                border: "1px solid #f0f0f0", background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <GoogleLogo size={22} />
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 16, lineHeight: 1.3, margin: 0 }}>Sign in with Google</p>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>to continue to Raconteur</p>
              </div>
            </div>

            <div style={{ height: 1, background: "#f3f4f6", margin: "0 24px" }} />

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
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 10, padding: "14px 20px",
                    background: "#fff", border: "1.5px solid #e5e7eb",
                    borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    cursor: "pointer", fontSize: 16, fontWeight: 500,
                    color: "#1d1d1f", fontFamily: "inherit",
                  }}
                >
                  <GoogleLogo size={20} />
                  Continue with Google
                </motion.button>
              )}
              {sheetError && (
                <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 12 }}>{sheetError}</p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "12px 32px", fontSize: 15, color: "#9ca3af",
                  fontWeight: 500, background: "none", border: "none",
                  cursor: "pointer", fontFamily: "inherit",
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

function GoogleLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size, flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}


