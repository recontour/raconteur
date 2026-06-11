"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  checkDiary,
  saveToDiary,
  saveToProgress,
  updateProgress,
  seedDiary,
  getDiaryVersion,
} from "@/lib/summer-engine";
import type { DiaryScene, DiaryOption } from "@/lib/types";

export async function recordVisit(sessionId: string) {
  try {
    await adminDb.collection("stats").doc("global").set(
      { visits: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    // First visit — seed the seenAt array with the current timestamp
    await adminDb.collection("anon").doc(sessionId).set(
      { seenAt: FieldValue.arrayUnion(new Date().toISOString()) },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording visit:", error);
    return { success: false };
  }
}

export async function recordPageView(sessionId: string) {
  try {
    await adminDb.collection("anon").doc(sessionId).set(
      { seenAt: FieldValue.arrayUnion(new Date().toISOString()) },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error("Error recording page view:", error);
    return { success: false };
  }
}

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
        systemInstruction:
          "You are Summer, a storyteller for Raconteur. You want to know about this listener to suggest the perfect story. Be warm, curious, and concise. Max 60 words.",
      },
    });

    return { success: true, text: response.text };
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return { success: false, error: String(error) };
  }
}

// ─── Welcome greeting — personal, RAG-contextualised ─────────────────────────

export async function generateWelcomeMessage(ragContext: string): Promise<string> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: ragContext }] }],
      config: {
        systemInstruction:
          "You are Summer, a poetic storyteller for Raconteur. Greet this listener warmly and hint that you want to find them the perfect story. Be human and brief. Max 4 sentences, around 55 words.",
      },
    });
    return response.text?.trim() ?? "";
  } catch (error) {
    console.error("generateWelcomeMessage failed:", error);
    return "";
  }
}

// ─── Audiobook sales pitch — books RAG context ────────────────────────────────

export async function generateBookSalesResponse(
  booksContext: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: booksContext }] }],
      config: {
        systemInstruction:
          "You are a guide helping someone rediscover timeless forgotten audiobooks. Speak as if they are trying to understand the universe. Be poetic, warm, and brief. Max 100 words, 3 lines.",
      },
    });
    return { success: true, text: response.text?.trim() };
  } catch (error) {
    console.error("generateBookSalesResponse failed:", error);
    return { success: false, error: String(error) };
  }
}

// ─── Diary scene loaders ──────────────────────────────────────────────────────

export async function getScene(sceneId: string): Promise<DiaryScene> {
  return checkDiary(sceneId);
}

export async function getBootstrapData(): Promise<{
  diaryVersion: number;
  welcomeScene: DiaryScene;
}> {
  const [diaryVersion, welcomeScene] = await Promise.all([
    getDiaryVersion(),
    checkDiary("welcome"),
  ]);
  return { diaryVersion, welcomeScene };
}

// ─── Anon path tracking ───────────────────────────────────────────────────────

export async function saveAnonPath(
  sessionId: string,
  path: string[],
): Promise<{ success: boolean }> {
  try {
    await adminDb
      .collection("anon")
      .doc(sessionId)
      .set({ path, updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ─── Admin: generate scene via Gemini ─────────────────────────────────────────

export async function generateScene(
  sceneId: string,
  ragContext: string,
  adminUid: string,
): Promise<{
  success: boolean;
  scene?: DiaryScene;
  ps?: string;
  progressId?: string;
  durationMs?: number;
  error?: string;
}> {
  const adminUids = (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!adminUids.includes(adminUid)) {
    return { success: false, error: "Unauthorized" };
  }

  const model = "gemini-3.1-flash-lite";
  const prompt = `Hey Gemini — I'm Summer, a bot at Raconteur. My dev is stuck on the creative part (yes, the same human typing this) and we need your help.

Scene I need content for: "${sceneId}"

User journey context:
${ragContext}

Give me a short punchy hero message and up to 5 option buttons. Warm, a little Snoop energy — professional but not Batman's butler. Like a friend who reads too much.

CRITICAL: Reply ONLY in raw JSON. No markdown. No backticks. No explanation. Raw JSON only.

{
  "heroMessage": "...",
  "options": [
    { "label": "...", "type": "navigate", "nextScene": "sceneName" },
    { "label": "\u2190 Back", "type": "back" }
  ],
  "ps": "your honest feedback on this scene"
}

Valid option types: "navigate" (nextScene required), "redirect" (href required), "coming_soon", "back", "login".`;

  const rawRequest = { model, sceneId, adminUid: "[redacted]", ragContext, prompt };
  const createdAt = new Date().toISOString();
  const t0 = Date.now();

  // Pre-save — ensures we have a progressId even if Gemini fails
  const progressId = await saveToProgress({
    sceneId,
    adminUid,
    prompt,
    rawRequest,
    model,
    createdAt,
  });

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({});
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          "You are Summer, a sharp warm storytelling bot. Reply ONLY with raw JSON when asked to design a scene. No markdown. No backticks. Just JSON.",
      },
    });

    const durationMs = Date.now() - t0;
    const rawText = result.text?.trim() ?? "";

    let parsed: { heroMessage: string; options: DiaryOption[]; ps?: string } | null = null;
    try {
      const clean = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      const rawParsed = JSON.parse(clean);
      
      // 1. Structural Validation
      if (!rawParsed || typeof rawParsed !== "object") throw new Error("Parsed JSON is not an object");
      if (typeof rawParsed.heroMessage !== "string") throw new Error("Missing or invalid heroMessage");
      if (!Array.isArray(rawParsed.options)) throw new Error("Missing or invalid options array");

      // 2. Self-Correcting Data Cleaning
      const validOptions: DiaryOption[] = rawParsed.options.map((opt: any) => {
        // Fallback for missing labels
        let label = typeof opt.label === "string" ? opt.label : "Continue";
        
        // Enforce valid types
        const validTypes = ["navigate", "redirect", "login", "back", "coming_soon"];
        let type = validTypes.includes(opt.type) ? opt.type : "coming_soon";

        // Logic fixes: Ensure navigate has a nextScene, redirect has an href.
        // If Gemini hallucinates and forgets the target, we gracefully degrade to 'coming_soon'
        let nextScene = opt.nextScene;
        let href = opt.href;

        if (type === "navigate" && typeof nextScene !== "string") {
          type = "coming_soon";
          nextScene = undefined;
        }
        
        if (type === "redirect" && typeof href !== "string") {
          type = "coming_soon";
          href = undefined;
        }

        return {
          label,
          type,
          ...(nextScene && { nextScene }),
          ...(href && { href })
        } as DiaryOption;
      });

      parsed = {
        heroMessage: rawParsed.heroMessage,
        options: validOptions,
        ps: typeof rawParsed.ps === "string" ? rawParsed.ps : undefined
      };

    } catch (parseError) {
      const errorMsg = parseError instanceof Error ? parseError.message : "JSON parse/validation failed";
      await updateProgress(progressId, {
        rawResponse: rawText,
        error: `${errorMsg}. Raw: ${rawText.slice(0, 500)}`,
        durationMs,
      });
      return { success: false, progressId, durationMs, error: errorMsg };
    }

    const newScene: DiaryScene = {
      id: sceneId,
      heroMessage: parsed!.heroMessage,
      options: parsed!.options,
      generatedBy: "gemini",
      updatedAt: new Date().toISOString(),
    };

    await Promise.all([
      saveToDiary(sceneId, newScene),
      updateProgress(progressId, {
        rawResponse: { text: rawText },
        parsedScene: newScene,
        durationMs,
      }),
    ]);

    return { success: true, scene: newScene, ps: parsed!.ps, progressId, durationMs };
  } catch (error) {
    const durationMs = Date.now() - t0;
    const errorStr = String(error);
    await updateProgress(progressId, { rawResponse: null, error: errorStr, durationMs });
    return { success: false, progressId, durationMs, error: errorStr };
  }
}