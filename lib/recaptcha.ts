// ---------------------------------------------------------------------------
// reCAPTCHA Enterprise — client-side utility
// ---------------------------------------------------------------------------
// Add to .env.local:
//   NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=6LcHm-YsAAAAAMuwCus56t_g9IuRGRe9ID13aGOC

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready(cb: () => void | Promise<void>): void;
        execute(siteKey: string, opts: { action: string }): Promise<string>;
      };
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY!;

/**
 * Execute an Enterprise reCAPTCHA check and return the assessment token.
 * The token expires after 2 minutes — verify it server-side immediately.
 *
 * @param action  A short label describing the protected action (e.g. "LOGIN").
 *                Must match what you pass to the backend verification endpoint.
 */
export function executeRecaptcha(action: string): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("executeRecaptcha must be called client-side"));
  }

  // grecaptcha.enterprise.ready() fires when the API object exists, but the
  // internal client registration (a network handshake) happens ~100 ms later.
  // Calling execute() in that window throws "No reCAPTCHA clients exist".
  // We wait for ready(), then poll execute() until it stops throwing that
  // specific error — no visual challenge, no popup, completely silent.
  const attempt = (retriesLeft: number): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const tryExecute = () => {
        const onError = (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("No reCAPTCHA clients exist") && retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1).then(resolve).catch(reject), 150);
          } else {
            reject(err);
          }
        };

        try {
          window.grecaptcha.enterprise
            .execute(SITE_KEY, { action })
            .then(resolve)
            .catch(onError);
        } catch (err) {
          // execute() throws synchronously before returning a promise
          onError(err);
        }
      };

      const waitForReady = () =>
        // Small delay after ready() so the Enterprise client finishes
        // registering before we call execute(). This avoids the race on
        // first page load without needing retries on most calls.
        window.grecaptcha.enterprise.ready(() => { setTimeout(tryExecute, 100); });

      if (window.grecaptcha?.enterprise) {
        waitForReady();
      } else {
        // Script not yet injected — poll until it appears
        let polls = 0;
        const id = setInterval(() => {
          if (window.grecaptcha?.enterprise) {
            clearInterval(id);
            waitForReady();
          } else if (++polls > 100) {
            clearInterval(id);
            reject(new Error("reCAPTCHA Enterprise failed to load"));
          }
        }, 50);
      }
    });

  return attempt(10); // up to 10 retries × 150 ms = 1.5 s safety net
}
