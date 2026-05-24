"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchMoodTrackUrl } from "@/lib/moodMusic";

const TARGET_VOLUME = 0.28;
const FADE_STEP     = 0.02;
const FADE_INTERVAL = 50; // ms

export function useMoodMusic(mood: string) {
  const [enabled, setEnabled]   = useState(false);
  const audioRef                = useRef<HTMLAudioElement | null>(null);
  const currentMoodRef          = useRef<string>("");
  const fadeTimerRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeOut = useCallback(
    (audio: HTMLAudioElement, onDone: () => void) => {
      clearFade();
      fadeTimerRef.current = setInterval(() => {
        if (audio.volume > FADE_STEP) {
          audio.volume = Math.max(0, audio.volume - FADE_STEP);
        } else {
          audio.volume = 0;
          audio.pause();
          clearFade();
          onDone();
        }
      }, FADE_INTERVAL);
    },
    [clearFade]
  );

  const fadeIn = useCallback(
    (audio: HTMLAudioElement) => {
      clearFade();
      audio.volume = 0;
      audio.play().catch(() => {/* autoplay blocked — user must interact first */});
      fadeTimerRef.current = setInterval(() => {
        if (audio.volume < TARGET_VOLUME - FADE_STEP) {
          audio.volume = Math.min(TARGET_VOLUME, audio.volume + FADE_STEP);
        } else {
          audio.volume = TARGET_VOLUME;
          clearFade();
        }
      }, FADE_INTERVAL);
    },
    [clearFade]
  );

  const loadAndPlay = useCallback(
    async (targetMood: string) => {
      const url = await fetchMoodTrackUrl(targetMood);
      if (!url) return;

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
      }
      const audio = audioRef.current;
      audio.pause();
      audio.src = url;
      audio.load();
      audio.addEventListener("canplaythrough", () => fadeIn(audio), { once: true });
    },
    [fadeIn]
  );

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  // Master effect — reacts to enabled toggle and mood changes
  useEffect(() => {
    if (!enabled) {
      if (audioRef.current && !audioRef.current.paused) {
        fadeOut(audioRef.current, () => {});
      }
      return;
    }

    const isAlreadyPlaying =
      audioRef.current &&
      !audioRef.current.paused &&
      mood === currentMoodRef.current;

    if (isAlreadyPlaying) return;

    const previousMood = currentMoodRef.current;
    currentMoodRef.current = mood;

    if (previousMood && audioRef.current && !audioRef.current.paused) {
      fadeOut(audioRef.current, () => loadAndPlay(mood));
    } else {
      loadAndPlay(mood);
    }
  }, [enabled, mood, fadeOut, loadAndPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearFade();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [clearFade]);

  return { enabled, toggle };
}
