import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "@/app/helper/auth";

export const metadata: Metadata = {
  title: "Raconteur",
  description: "Your personal travel storytelling companion.",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Landscape orientation gate — CSS blocks app, shows this */}
        <div id="landscape-gate" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M12 9v6M9 12l3-3 3 3" />
          </svg>
          <p>Please rotate your device to portrait mode</p>
        </div>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
