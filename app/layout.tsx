import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "@/app/helper/auth";

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
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
