import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/app/helper/auth";
import { UserBubble } from "@/app/helper/components";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Raconteur",
  description: "Your app description here",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-neutral-200">
        {/* reCAPTCHA Enterprise — invisible, no badge, loaded after hydration */}
        <Script
          src={`https://www.google.com/recaptcha/enterprise.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY}`}
          strategy="afterInteractive"
        />
        <AuthProvider>
          {/* Phone-view shell — max 480px on desktop, full-width on mobile */}
          <div className="w-full max-w-120 mx-auto flex-1 flex flex-col bg-white min-h-dvh relative">
            <UserBubble />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
