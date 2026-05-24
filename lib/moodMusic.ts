export async function fetchMoodTrackUrl(mood: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/mood-music?mood=${encodeURIComponent(mood)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}
