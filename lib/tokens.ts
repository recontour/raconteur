// ── Design tokens ─────────────────────────────────────────────────────────────
// Centralised constants used across all pages and components.

/** Framer-motion ease curve — Apple-style spring feel */
export const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

/** Subtle dot-grid texture for dark card surfaces */
export const DOT_TEXTURE = {
  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
  backgroundSize: "20px 20px",
} as const;

/** Tailwind class string for section labels (e.g. "Near you", "Report") */
export const sectionLabelCls =
  "text-[10px] font-medium uppercase tracking-widest text-gray-400";

/** Tailwind class string for onboarding text inputs */
export const inputCls =
  "w-full px-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] text-lg transition-all placeholder:text-gray-400 bg-white";
