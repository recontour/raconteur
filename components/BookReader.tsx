"use client";

import { useState, useEffect } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import AudioPlayer from "./AudioPlayer";
import styles from "./BookReader.module.css";

interface Story {
  id: number;
  title: string;
  paragraph: string;
  audioFile: string;
  duration: number;
  subtitles: Array<{ time: number; text: string }>;
}

interface BookReaderProps {
  stories: Story[];
}

// Dynamic background generator based on story content
function generateBackgroundStyle(paragraph: string) {
  const lowerText = paragraph.toLowerCase();
  const isFestival = lowerText.includes("festival") || lowerText.includes("summer");
  
  if (isFestival) {
    return {
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #2a1f3d 60%, #1a1a2e 100%)",
      boxShadow: "inset 0 0 60px rgba(255, 140, 0, 0.08)",
    };
  }
  
  return {
    background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)",
    boxShadow: "none",
  };
}

export default function BookReader({ stories }: BookReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [bgStyle, setBgStyle] = useState<{ background: string; boxShadow: string }>({
    background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)",
    boxShadow: "none",
  });

  const currentStory = stories[currentPage];
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === stories.length - 1;

  // Update background when page changes
  useEffect(() => {
    setBgStyle(generateBackgroundStyle(currentStory.paragraph));
  }, [currentPage, currentStory.paragraph]);

  const goToNextPage = () => {
    if (!isLastPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (!isFirstPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNavigation = (direction: "up" | "down") => {
    if (direction === "down") {
      goToNextPage();
    } else {
      goToPreviousPage();
    }
  };

  useSwipeGesture({
    onSwipeUp: goToNextPage,
    onSwipeDown: goToPreviousPage,
    onScroll: handleNavigation,
    threshold: 50,
  });

  return (
    <div 
      className={styles.reader}
      style={{
        background: bgStyle.background,
        boxShadow: bgStyle.boxShadow,
      } as React.CSSProperties}
    >
      <div className={styles.pageContainer}>
        {/* Book Title */}
        <div className={styles.bookTitleSection}>
          <h1 className={styles.bookTitle}>The Ones Who Walk Away from Omelas</h1>
          <div className={styles.titleDivider} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{currentStory.title}</h1>
          <div className={styles.pageIndicator}>
            <span className={styles.current}>{currentPage + 1}</span>
            <span className={styles.divider}>/</span>
            <span className={styles.total}>{stories.length}</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <p className={styles.paragraph}>{currentStory.paragraph}</p>
        </div>

        {/* Audio */}
        <div className={styles.audioSection}>
          <AudioPlayer
            audioSrc={currentStory.audioFile}
            title={currentStory.title}
            subtitles={currentStory.subtitles}
          />
        </div>

        {/* Navigation */}
        <div className={styles.navigation}>
          <button
            onClick={goToPreviousPage}
            disabled={isFirstPage}
            className={styles.navButton}
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
            <span>Prev</span>
          </button>

          <div className={styles.dots}>
            {stories.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx)}
                className={`${styles.dot} ${
                  idx === currentPage ? styles.activeDot : ""
                }`}
                aria-label={`Page ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={goToNextPage}
            disabled={isLastPage}
            className={styles.navButton}
            aria-label="Next"
          >
            <span>Next</span>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
