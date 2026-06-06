"use server";

import { adminDb } from "@/lib/firebase-admin";

export async function saveAnonProgress(sessionId: string, page: number, time: number) {
  try {
    await adminDb.collection("anon").doc(sessionId).set(
      { progress: { page, time }, updatedAt: new Date().getTime() },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error("Error saving anon progress:", error);
    return { success: false };
  }
}

export async function getAnonProgress(sessionId: string): Promise<{ page: number; time: number } | null> {
  try {
    const doc = await adminDb.collection("anon").doc(sessionId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (typeof data?.progress?.page !== "number") return null;
    return data.progress as { page: number; time: number };
  } catch (error) {
    console.error("Error getting anon progress:", error);
    return null;
  }
}

export async function saveAnonMessage(sessionId: string, text: string) {
  try {
    await adminDb.collection("anon").doc(sessionId).collection("messages").add({
      text,
      timestamp: new Date().getTime(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving anon message:", error);
    return { success: false, error: String(error) };
  }
}

// Function to call Gemini via @google/genai
export async function generateStoryResponse(userText: string) {
  try {
    // We dynamically import to avoid client-side issues, 
    // but this is a server action so it's fine.
    const { GoogleGenAI } = await import("@google/genai"); 
    // Assuming process.env.GEMINI_API_KEY is set
    const ai = new GoogleGenAI({});
    // Using gemini-2.5-flash as the lite model per current standards (or whatever is standard, maybe gemini-3.0-flash later)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
      config: {
        systemInstruction: "You are a StoryInterface content writer for Raconteur. Keep responses engaging and concise.",
      },
    });

    return { success: true, text: response.text };
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return { success: false, error: String(error) };
  }
}