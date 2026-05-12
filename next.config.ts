import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Fix chunk load errors caused by spaces in the project path ("VS projects")
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Allow Firebase signInWithPopup / linkWithPopup to poll window.closed
        // on the OAuth popup without being blocked by COOP.
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            // Allow reCAPTCHA Enterprise to use the Private State Token API.
            // Without this Chrome logs "Unrecognized feature: 'private-token'".
            key: "Permissions-Policy",
            value: "private-state-token-issuance=*, private-state-token-redemption=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
