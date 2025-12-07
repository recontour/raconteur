import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Define your base URL
// When you deploy to Vercel, you will add a generic environment variable,
// or you can just hardcode your domain here like "https://your-app.com"
const baseURL = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseURL),
  title: "AI Tales | Interactive Noir & Sci-Fi Stories",
  description:
    "A dynamic storytelling engine powered by AI. Your choices write the history. Play Noir, Cyberpunk, Horror, and Fantasy genres.",

  // Facebook / Instagram / WhatsApp
  openGraph: {
    title: "AI Tales - Write Your Own Destiny",
    description:
      "Choose a genre and let AI generate a unique interactive novel just for you.",
    url: baseURL,
    siteName: "AI Tales",
    images: [
      {
        url: "/og-image.jpg", // Make sure this file is in your 'public' folder
        width: 1200,
        height: 630,
        alt: "AI Tales Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  // Twitter / X
  twitter: {
    card: "summary_large_image",
    title: "AI Tales | Infinite Interactive Fiction",
    description:
      "Play unique, AI-generated text adventures. No two stories are the same.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
