"use server";

import { adminDb } from "@/lib/firebase-admin";

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