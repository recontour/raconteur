"use client";

import React, { useState, useEffect, useRef } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onType?: () => void; // New prop to trigger scroll
}

export default function Typewriter({
  text,
  speed = 30,
  onComplete,
  onType,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");
  const index = useRef(0);
  const hasCompleted = useRef(false);

  useEffect(() => {
    setDisplayedText("");
    index.current = 0;
    hasCompleted.current = false;
  }, [text]);

  useEffect(() => {
    if (index.current >= text.length) {
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onComplete?.();
      }
      return;
    }

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index.current));
      index.current++;

      // Trigger scroll on every character (or you can do it every 5 chars for performance)
      onType?.();

      if (index.current >= text.length) {
        clearInterval(intervalId);
        if (!hasCompleted.current) {
          hasCompleted.current = true;
          onComplete?.();
        }
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed, onComplete, onType]);

  return (
    <span className="whitespace-pre-line">
      {displayedText}
      {index.current < text.length && (
        <span className="animate-pulse font-light opacity-70">|</span>
      )}
    </span>
  );
}
