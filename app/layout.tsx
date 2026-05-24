import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthProvider } from "@/app/helper/auth";

export const metadata: Metadata = {
  title: "Raconteur | Immersive Storytelling",
  description: "Experience captivating stories like never before. Raconteur blends rich narratives with interactive audio and visual elements for a truly immersive journey.",
  openGraph: {
    title: "Raconteur | Immersive Storytelling",
    description: "Experience captivating stories like never before. Raconteur blends rich narratives with interactive audio and visual elements for a truly immersive journey.",
    siteName: "Raconteur",
    images: [
      {
        url: "/siteOG.png",
        width: 1200,
        height: 630,
        alt: "Raconteur - Immersive Storytelling",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raconteur | Immersive Storytelling",
    description: "Experience captivating stories like never before. Raconteur blends rich narratives with interactive audio and visual elements for a truly immersive journey.",
    images: ["/siteOG.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
