"use client";

import React from "react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { StoryNode } from "@/types";

interface ActiveStoryNodeProps {
  node: StoryNode;
  onComplete: () => void;
  onType: () => void; // <--- NEW PROP
  speed?: number;
}

export default function ActiveStoryNode({
  node,
  onComplete,
  onType,
  speed = 20,
}: ActiveStoryNodeProps) {
  // Pass onType to the hook
  const { displayedText, isTyping, skip } = useTypewriter(
    node.content,
    speed,
    onComplete,
    onType
  );

  return (
    <div className="relative" onClick={skip}>
      <p className="text-base md:text-lg leading-relaxed mt-2 text-neutral-300 whitespace-pre-line font-sans">
        {displayedText}
        {isTyping && (
          <span className="inline-block w-2 h-5 bg-red-500/50 ml-1 animate-pulse align-middle" />
        )}
      </p>

      {/* Page Counter */}
      <div className="mt-2 text-right border-b border-white/5 pb-1">
        <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">
          Page {node.page_number}
        </span>
      </div>
    </div>
  );
}
