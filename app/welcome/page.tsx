"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";
import Image from "next/image";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function WelcomePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const firstName = user?.displayName?.split(" ")[0] ?? null;
  const photoURL = user?.photoURL ?? null;
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : user?.phoneNumber?.slice(-2) ?? "?";

  return (
    <div
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col"
      style={{ fontFamily: SF }}
    >
      {/* Top-right avatar */}
      <div className="flex justify-end px-5 pt-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease }}
          className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm ring-1 ring-black/10"
        >
          {photoURL ? (
            <Image
              src={photoURL}
              alt="Profile"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-600 select-none">{initials}</span>
          )}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-5 max-w-sm mx-auto w-full">
        {/* Checkmark */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease }}
          className="w-20 h-20 rounded-full bg-black flex items-center justify-center shadow-lg"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            {firstName ? `Welcome, ${firstName}.` : "You're in."}
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Thanks for registering. Your account is all set up and ready to go.
          </p>
        </motion.div>
      </div>

      {/* CTA pinned to bottom */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3, ease }}
        className="w-full max-w-sm mx-auto px-6 pb-8"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}
      >
        <button
          onClick={() => {/* TODO: navigate to main app */ }}
          className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
        >
          Get Started
        </button>
      </motion.div>
    </div>
  );
}

