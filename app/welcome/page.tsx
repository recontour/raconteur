"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";

export default function WelcomePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const name = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div
      className="h-dvh bg-white flex flex-col items-center justify-center px-6 text-center"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4 max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center shadow-lg mx-auto mb-6">
          <span className="text-white text-2xl font-bold">R</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-[#1d1d1f]">
          Welcome, {name}.
        </h1>
        <p className="text-gray-500 text-lg leading-relaxed">
          You&apos;re all set. Your storytelling journey starts here.
        </p>
      </motion.div>
    </div>
  );
}
