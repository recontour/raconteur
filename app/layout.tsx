import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/app/helper/auth";
import { UserBubble } from "@/app/helper/components";

export const metadata: Metadata = {
  title: "Raconteur",
  description: "Your personal travel storytelling companion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
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
