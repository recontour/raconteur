"use client";

import { motion } from "framer-motion";
import { ease } from "@/lib/tokens";

interface HomeTileProps {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  variant?: "dark" | "light";
  delay?: number;
  onClick: () => void;
}

export default function HomeTile({
  label,
  subtitle,
  icon,
  variant = "dark",
  delay = 0,
  onClick,
}: HomeTileProps) {
  const isDark = variant === "dark";

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative w-full aspect-square rounded-[28px] overflow-hidden
        flex flex-col justify-end p-5 text-left
        ${isDark ? "bg-[#1d1d1f]" : "bg-[#f5f5f0]"}
      `}
    >
      {/* Texture overlay */}
      {isDark ? (
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      ) : (
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #e8e8e0 25%, transparent 25%, transparent 50%, #e8e8e0 50%, #e8e8e0 75%, transparent 75%)",
            backgroundSize: "8px 8px",
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-2">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${isDark ? "bg-white/10" : "bg-black/8"}
          `}
        >
          {icon}
        </div>
        <div>
          <p
            className={`font-semibold text-[15px] leading-snug ${
              isDark ? "text-white" : "text-[#1d1d1f]"
            }`}
          >
            {label}
          </p>
          <p
            className={`text-[11px] mt-0.5 ${
              isDark ? "text-white/50" : "text-[#1d1d1f]/40"
            }`}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
