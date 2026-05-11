import { GoogleGenAI } from "@google/genai";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface WtfFact {
  context: string;
  option1: string;
  option2: string;
  correctOption: 1 | 2;
  fullExplanation: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function GET() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents:
        "Generate a surprising and mind-blowing fun 'WTF Fact' trivia question. " +
        "Return ONLY a valid JSON object with no markdown, no code fences, no extra text. " +
        "The JSON must have exactly these fields: " +
        '{ "context": "A one-sentence setup or question that teases both options", ' +
        '"option1": "First fact option (string)", ' +
        '"option2": "Second fact option (string)", ' +
        '"correctOption": 1 or 2 (integer — which option is the true WTF fact), ' +
        '"fullExplanation": "Detailed explanation of the real fact with sources or context" }. ' +
        "Randomly vary which option (1 or 2) is the correct answer each time. " +
        "Make the incorrect option plausible and interesting but subtly wrong. " +
        "Topics can include science, history, animals, space, human body, food, or culture.",
      config: {
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "";
    const fact: WtfFact = JSON.parse(raw);

    // Validate structure
    if (
      !fact.context ||
      !fact.option1 ||
      !fact.option2 ||
      !fact.fullExplanation ||
      (fact.correctOption !== 1 && fact.correctOption !== 2)
    ) {
      return Response.json(
        { error: "Invalid fact structure from AI" },
        { status: 500 }
      );
    }

    // Save to Firestore (server-side Admin SDK — bypasses security rules)
    await adminDb.collection("wtfFacts").add({
      ...fact,
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json(fact);
  } catch (err) {
    console.error("WTF fact generation error:", err);
    return Response.json(
      { error: "Failed to generate fact" },
      { status: 500 }
    );
  }
}
