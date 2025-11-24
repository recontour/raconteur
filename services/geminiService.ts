import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Genre, StorySegment, HistoryItem } from "../types";
import { getSystemInstruction } from "../constants";

const API_KEY =
  (import.meta.env && import.meta.env.VITE_GEMINI_KEY) ||
  process.env.REACT_APP_GEMINI_KEY;

if (!API_KEY) {
  console.error(
    "CRITICAL ERROR: No API Key found. Please check Vercel Environment Variables."
  );
  // We throw a clear error instead of letting the SDK crash the whole app
  throw new Error("Missing API Key");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Ideally, this should be in an environment variable, but for this demo structure:
// The user is expected to have process.env.API_KEY available or injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const continuationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    chapterTitle: {
      type: Type.STRING,
      description:
        "The title of the current chapter, e.g., 'Chapter 1: The Fog'",
    },
    storyText: {
      type: Type.STRING,
      description: "The main narrative text, under 700 characters.",
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: "The choice text shown to user",
          },
          type: {
            type: Type.STRING,
            description: "Either 'Logical' or 'Unexpected'",
          },
        },
        required: ["text", "type"],
      },
    },
  },
  required: ["chapterTitle", "storyText", "choices"],
};

const initialResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    storyTitle: {
      type: Type.STRING,
      description: "A creative, catchy title for this specific story.",
    },
    chapterTitle: {
      type: Type.STRING,
      description:
        "The title of the current chapter, e.g., 'Chapter 1: The Fog'",
    },
    storyText: {
      type: Type.STRING,
      description: "The main narrative text, under 700 characters.",
    },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description: "The choice text shown to user",
          },
          type: {
            type: Type.STRING,
            description: "Either 'Logical' or 'Unexpected'",
          },
        },
        required: ["text", "type"],
      },
    },
  },
  required: ["storyTitle", "chapterTitle", "storyText", "choices"],
};

export const startNewStory = async (genre: Genre): Promise<StorySegment> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `Begin a new story in the ${genre} genre. Set the scene and introduce the protagonist. Generate a catchy title for the story.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(genre),
        responseMimeType: "application/json",
        responseSchema: initialResponseSchema,
        temperature: 0.8, // Slightly creative
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as StorySegment;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const continueStory = async (
  genre: Genre,
  history: HistoryItem[],
  lastChoice: string
): Promise<StorySegment> => {
  try {
    const model = "gemini-2.5-flash";

    // Construct a focused prompt that summarizes context to save tokens/complexity,
    // or send the last few turns. For this engine, we will send the last few exchanges
    // plus the explicit instruction.

    // We limit history to last 6 turns to keep context tight and relevant
    const recentHistory = history.slice(-6);

    let contextString = "PREVIOUS STORY CONTEXT:\n";
    recentHistory.forEach((h) => {
      contextString += `${
        h.role === "user" ? "User Choice" : "Story Segment"
      }: ${h.text}\n`;
    });

    const prompt = `${contextString}\n\nUSER'S LAST CHOICE: ${lastChoice}\n\nContinue the story based on this choice.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(genre),
        responseMimeType: "application/json",
        responseSchema: continuationSchema,
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as StorySegment;
  } catch (error) {
    console.error("Gemini API Error (Continue):", error);
    throw error;
  }
};
