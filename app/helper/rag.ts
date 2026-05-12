export interface RagResponse {
  response: string;
  cached: boolean;
}

/**
 * Fetches an AI response for the given option key.
 * - If a cached response exists in Firestore /refinerack/{key}, it is returned immediately.
 * - Otherwise the Gemini API is called, the result is cached, and then returned.
 */
export async function fetchRagResponse(
  key: string,
  prompt: string
): Promise<RagResponse> {
  const res = await fetch("/api/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, prompt }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch RAG response");
  }

  return res.json() as Promise<RagResponse>;
}
