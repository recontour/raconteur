"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ReportCardProps {
  city?: string;
  paragraphs: string[];
  images: string[];
  loading?: boolean;
}

const SPRING = { type: "spring", damping: 30, stiffness: 300, mass: 0.9 } as const;

export default function ReportCard({ city, paragraphs, images, loading }: ReportCardProps) {
  const [active, setActive]   = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = active !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  const total = loading ? 4 : Math.min(paragraphs.length, 4);

  const navigate = (dir: 1 | -1) => {
    if (active === null) return;
    const next = active + dir;
    if (next >= 0 && next < total) setActive(next);
  };

  return (
    <>
      <motion.div
        className="rc-report"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="rc-report__header">
          <span className="rc-report__label">Report</span>
          {city && <span className="rc-report__city">{city}</span>}
        </div>

        {/* 2×2 grid */}
        <div className="rc-report__grid">
          {Array.from({ length: total }).map((_, i) => (
            loading ? (
              <motion.div
                key={i}
                className="rc-report__tile rc-report__tile--skeleton"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ) : (
              <motion.button
                key={i}
                className="rc-report__tile"
                onClick={() => setActive(i)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                whileTap={{ scale: 0.96, transition: { duration: 0.1 } }}
              >
                {images[i] && (
                  <div
                    className="rc-report__tile-img"
                    style={{ backgroundImage: `url(${images[i]})` }}
                  />
                )}
                <div className="rc-report__tile-body">
                  <span className="rc-report__tile-num">0{i + 1}</span>
                  <p className="rc-report__tile-text">{paragraphs[i]}</p>
                </div>
              </motion.button>
            )
          ))}
        </div>
      </motion.div>

      {/* ── Portal: backdrop + bottom sheet ──────────────────────────────── */}
      {mounted && createPortal(
        <AnimatePresence>
          {active !== null && (
            <>
              {/* Backdrop */}
              <motion.div
                className="rc-report__backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setActive(null)}
              />

              {/* Sheet */}
              <motion.div
                className="rc-report__sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={SPRING}
              >
                {/* Drag pill */}
                <div className="rc-report__sheet-pill" />

                {/* Image */}
                <div className="rc-report__sheet-img-wrap">
                  {images[active] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={images[active]}
                      alt={`${city ?? ""} ${active + 1}`}
                      className="rc-report__sheet-img"
                    />
                  ) : (
                    <div className="rc-report__sheet-img-placeholder" />
                  )}

                  {/* Close */}
                  <button
                    className="rc-report__close"
                    onClick={() => setActive(null)}
                    aria-label="Close"
                  >
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M1 1L13 13M13 1L1 13"
                        stroke="rgba(255,255,255,0.72)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="rc-report__sheet-body">
                  <div className="rc-report__sheet-meta">
                    <span className="rc-report__sheet-count">
                      0{active + 1} / 0{total}
                    </span>

                    {/* Prev / Next */}
                    <div className="rc-report__sheet-nav">
                      <button
                        className="rc-report__nav-btn"
                        onClick={() => navigate(-1)}
                        disabled={active === 0}
                        aria-label="Previous"
                      >
                        <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
                          <path
                            d="M8 1L2 7L8 13"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="rc-report__nav-btn"
                        onClick={() => navigate(1)}
                        disabled={active === total - 1}
                        aria-label="Next"
                      >
                        <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
                          <path
                            d="M1 1L7 7L1 13"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={active}
                      className="rc-report__sheet-text"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      {paragraphs[active]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
