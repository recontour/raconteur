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
        ],
      },
    ];
  },
};

export default nextConfig;
