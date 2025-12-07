"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import MobileContainer from "@/components/layout/MobileContainer";
import LoginModal from "@/components/ui/LoginModal";

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <MobileContainer className="bg-neutral-950">
      {/* Container for Centering:
        - h-full: Takes up the full height of the phone container
        - flex flex-col justify-center: Pushes everything to the vertical center
      */}
      <div className="h-full flex flex-col justify-center items-center p-8 relative">
        {/* Background Ambience */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800/40 via-neutral-950/60 to-black pointer-events-none" />

        {/* --- Content Group --- */}
        <div className="z-10 w-full max-w-xs space-y-12 text-center">
          {/* 1. Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <h1 className="text-5xl font-bold tracking-tighter text-white mb-4">
              AI TALES
            </h1>
            <div className="h-1 w-16 bg-red-700 mx-auto rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          </motion.div>

          {/* 2. Brief */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2.5, delay: 0.8, ease: "easeInOut" }}
            className="text-neutral-400 text-lg leading-relaxed"
          >
            <p>
              One detective.
              <br />
              Infinite timelines.
            </p>
          </motion.div>

          {/* 3. Button */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 3, delay: 2, ease: "easeOut" }}
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-white text-black font-bold text-lg py-4 rounded-xl shadow-2xl hover:bg-neutral-200 active:scale-95 transition-all duration-300"
            >
              Enter the Mystery
            </button>
            <p className="text-xs text-neutral-600 mt-4 tracking-wide uppercase">
              Case Files Secure
            </p>
          </motion.div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </MobileContainer>
  );
}
