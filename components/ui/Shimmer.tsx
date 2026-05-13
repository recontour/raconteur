"use client";

import { motion } from "framer-motion";

/**
 * Pulsing grey placeholder used as loading skeleton.
 * Pass any Tailwind sizing/shape classes via `className`.
 */
export function Shimmer({ className }: { className: string }) {
  return (
    <motion.div
      className={`bg-gray-100 rounded-2xl overflow-hidden ${className}`}
      animate={{ opacity: [0.45, 0.9, 0.45] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
