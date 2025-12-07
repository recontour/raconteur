"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Loader2 } from "lucide-react"; // Icons
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLoginMode) {
        // LOGIN LOGIC
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/game"); // Redirect to the game page
      } else {
        // SIGNUP LOGIC
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("Account created! You can now log in.");
        setIsLoginMode(true); // Switch to login view
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-50 p-4"
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-white mb-2">
                {isLoginMode ? "Welcome Back" : "Join the Force"}
              </h2>
              <p className="text-neutral-400 text-sm mb-6">
                {isLoginMode
                  ? "Enter your credentials to access the archives."
                  : "Create a secure ID to begin your investigation."}
              </p>

              {/* Form */}
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-3 text-neutral-500"
                      size={18}
                    />
                    <input
                      type="email"
                      placeholder="Detective ID (Email)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-3 text-neutral-500"
                      size={18}
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-neutral-600 transition-colors"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 active:scale-95 transition-all flex justify-center items-center"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : isLoginMode ? (
                    "Login"
                  ) : (
                    "Sign Up"
                  )}
                </button>
              </form>

              {/* Toggle Mode */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setError(null);
                  }}
                  className="text-neutral-500 text-sm hover:text-white transition-colors underline decoration-dotted"
                >
                  {isLoginMode
                    ? "Need an account? Sign Up"
                    : "Already have an account? Login"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
