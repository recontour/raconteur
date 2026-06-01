import React from "react";
import styles from "./BotInterface.module.css";
import { useAuthFlow } from "@/hooks/useAuthFlow";

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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.63A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function AuthOverlay({ authFlow, onCancel }: { authFlow: ReturnType<typeof useAuthFlow>, onCancel: () => void }) {
  const {
    authStep, setAuthStep,
    phoneInput, setPhoneInput,
    otpInput, setOtpInput,
    nameInput, setNameInput,
    authError, setAuthError,
    authBusy,
    handleSendOTP, handleVerifyOTP, handleSaveName, handleLinkGoogle, finalizeAuth
  } = authFlow;

  if (!authStep) return null;

  return (
    <div className={styles.authOverlay}>
      <div id="recaptcha-container" style={{ position: "absolute", bottom: 0, opacity: 0, pointerEvents: "none" }} />
      <div className={styles.authPanel}>

        {/* ── Method selection ──────────────────────────────────────── */}
        {(authStep as any) === "method" && (
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
            </div>
            {authBusy && (
              <div className={styles.hiveLoader}>
                <div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} />
              </div>
            )}
            {authError && <p className={styles.authError}>{authError}</p>}
            <button className={styles.authBack} onClick={() => { setAuthStep(null); setAuthError(null); onCancel(); }}>
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

        {/* ── Entering ──────────────────────────────────────────────── */}
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
}
