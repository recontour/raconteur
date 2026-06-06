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
  return <BookReader stories={stories} />;
}
