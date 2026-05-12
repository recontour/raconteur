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

  // grecaptcha.enterprise.ready() only guarantees the API object exists — the
  // internal client registration is async and can lag behind. When execute()
  // is called too early it throws "No reCAPTCHA clients exist". We catch that
  // error and retry with a short back-off (up to ~2 s total).
  const attempt = (retriesLeft: number): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const run = () => {
        const onError = (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("No reCAPTCHA clients exist") && retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1).then(resolve).catch(reject), 200);
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
          // execute() can throw synchronously before returning a promise
          onError(err);
        }
      };

      if (window.grecaptcha?.enterprise) {
        window.grecaptcha.enterprise.ready(run);
      } else {
        // Script not yet loaded — poll until it appears
        let polls = 0;
        const id = setInterval(() => {
          if (window.grecaptcha?.enterprise) {
            clearInterval(id);
            window.grecaptcha.enterprise.ready(run);
          } else if (++polls > 100) {
            clearInterval(id);
            reject(new Error("reCAPTCHA Enterprise failed to load"));
          }
        }, 50);
      }
    });

  return attempt(10); // up to 10 retries × 200 ms = 2 s window
}
