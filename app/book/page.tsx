"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import BookReader from "@/components/BookReader";
import storyData from "@/data/entireStory.json";

// Adapt entireStory paragraphs to the BookReader Story shape
const stories = storyData.paragraphs.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  paragraph: p.text,
  mood: p.mood,
  audioFile: p.audio,
  duration: p.duration ?? 0,
  subtitles: [] as Array<{ time: number; text: string }>,
}));

export default function BookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        router.push("/auth");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          background: "#f5f0e8",
          color: "#1d1d1f",
          fontSize: "1rem",
          letterSpacing: "0.04em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        }}
      >
        Loading story…
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <BookReader stories={stories} />;
}
