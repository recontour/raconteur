import { type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, prompt } = body as { key?: unknown; prompt?: unknown };

    if (!key || typeof key !== "string" || !prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "key and prompt are required strings" },
        { status: 400 }
      );
    }

    // Sanitise key into a safe Firestore document ID
    const docId = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);

    // ── Cache check ──────────────────────────────────────────────────────────
    // /refinerack acts as both index and response cache.
    // A document keyed by docId means we already have the answer — no AI call.
    const docRef = adminDb.collection("refinerack").doc(docId);
    const cached = await docRef.get();

    if (cached.exists) {
      const data = cached.data()!;
      return Response.json({ response: data.response as string, cached: true });
    }

    // ── Gemini call ───────────────────────────────────────────────────────────
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    const response = result.text ?? "";

    // ── Persist to /refinerack ───────────────────────────────────────────────
    await docRef.set({
      key: docId,
      prompt,
      response,
      model: "gemini-3.1-flash-lite-preview",
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ response, cached: false });
  } catch (err) {
    console.error("[RAG route] error:", err);
    return Response.json(
      { error: "Failed to fetch AI response" },
      { status: 500 }
    );
  }
}
