"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BookReader from "@/components/BookReader";
import { useAuth } from "@/app/helper/auth";
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
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading) {
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

  if (!user) return null; // redirect is in-flight

  return <BookReader stories={stories} />;
}
