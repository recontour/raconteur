"use client";

import React, { useState, useEffect } from "react";
import styles from "./BotInterface.module.css";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/helper/auth";
import Context, { RagDocument } from "@/components/Context";

export default function BotInterface() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ragContext, setRagContext] = useState<RagDocument[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    // Let the initial animations run, then remove the initial load state 
    // so future steps don't have delays.
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 10000); 
    return () => clearTimeout(timer);
  }, []);

  const dialogue = [
    {
      ai: "Welcome to Raconteur. What would you like to do today?",
      options: ["Continue Reading", "Start a New Story"],
      type: "row"
    },
    {
      ai: "What do you want your next story to be?",
      options: ["Science Fiction", "High Fantasy", "Cyberpunk", "Mystery Thriller", "Historical Fiction", "Horror"],
      type: "grid"
    },
    {
      ai: "The world takes shape around you based on your chosen path. The air is thick with anticipation. Two paths lay before you.",
      options: ["Venture boldly forward", "Carefully observe your surroundings"],
      type: "row"
    }
  ];

  const currentDialogue = dialogue[step];

  const transitionToStep = (nextStep: number) => {
    setExiting(true);
    setTimeout(() => {
      setStep(nextStep);
      setExiting(false);
      setLoading(false);
    }, 300); // Wait for fade out
  };

  const handleOptionClick = async (option: string) => {
    if (loading || isSubmitting) return;

    if (step === 0) {
      if (option === "Continue Reading") {
        if (user) {
          router.push("/book");
        } else {
          router.push("/auth");
        }
        return;
      }
      if (option === "Start a New Story") {
        setLoading(true);
        setTimeout(() => transitionToStep(1), 800);
        return;
      }
    }

    if (step === 1) {
      setLoading(true);
      setIsSubmitting(true);
      
      // MOCK SERVER ACTION: Write user genre choice to DB
      console.log("Saving user genre choice to database...", option);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency
      
      // UPDATE INDEX / RAG CONTEXT
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `The user requested a new story with the genre: ${option}`,
        metadata: { source: "User Preferences DB", type: "Genre Choice" },
        score: 1.0
      };
      
      setRagContext(prev => [newContextDoc, ...prev]);
      setIsSubmitting(false);

      transitionToStep(2);
      return;
    }

    if (step === 2) {
      setLoading(true);
      setIsSubmitting(true);
      
      // MOCK SERVER ACTION: Write user choice to DB
      console.log("Saving user choice to database...", option);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency
      
      // UPDATE INDEX / RAG CONTEXT
      const newContextDoc: RagDocument = {
        id: Date.now().toString(),
        content: `The user decided to: ${option}`,
        metadata: { source: "User History DB", type: "Choice" },
        score: 1.0
      };
      
      setRagContext(prev => [newContextDoc, ...prev]);
      setIsSubmitting(false);

      // Keep them on step 2, but trigger an animation
      transitionToStep(2);
      return;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Raconteur</h1>
      </div>

      <div className={styles.layout}>
        {/* Top Bubble */}
        <div 
          className={`${styles.topBubble} ${exiting ? styles.exiting : ""} ${
            step === 0 && isInitialLoad ? styles.initialTopBubble : ""
          }`}
        >
          <div className={styles.blobContent}>
            {loading ? (
              <div className={styles.hiveLoader}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            ) : (
              <div className={styles.textTransition} key={currentDialogue.ai}>
                {currentDialogue.ai}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bubbles */}
        <div className={currentDialogue.type === "grid" ? styles.optionsGrid : styles.optionsRow}>
          {currentDialogue.options.map((option, index) => (
            <button
              key={option}
              className={`${styles.bottomBubble} ${exiting ? styles.exiting : ""} ${
                step === 0 && isInitialLoad ? styles[`initialBottomBubble${index}`] : ""
              }`}
              onClick={() => handleOptionClick(option)}
              disabled={loading || isSubmitting}
            >
              <div className={styles.textTransition} key={option}>
                {option}
              </div>
            </button>
          ))}
        </div>

        {/* RAG Context Display */}
        {ragContext.length > 0 && (
          <div className={styles.ragContainer}>
            <Context documents={ragContext} isLoading={isSubmitting} />
          </div>
        )}
      </div>
    </div>
  );
}
