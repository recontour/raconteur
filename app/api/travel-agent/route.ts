import { type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const isDummyKey = !apiKey || apiKey.includes("your_actual");
const ai = !isDummyKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to reliably extract arrays (like tags) from the model response
function extractJSON(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* try next */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* try next */ } }
  const braced = t.match(/\[[\s\S]*\]/); // Array match for tags
  if (braced) { try { return JSON.parse(braced[0]); } catch { /* try next */ } }
  throw new Error("Cannot parse JSON from model response");
}

// Fetch real-time weather (Free, no API key required)
async function fetchWeather(location: string) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000); // 2 second timeout
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=%C+%t,+Wind+%w`, { signal: controller.signal });
    if (res.ok) return await res.text();
  } catch (e) {
    console.error("[Weather Fetch Error]", e);
  }
  return "Typical seasonal weather";
}

// GET /api/home-welcome
// Concierge Agent: Generates a welcome message with weather/AQI and updates the userIndex.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return Response.json({ 
      title: "What will be your next story?",
      message: "Discover the world's best destinations.", 
      userName: null 
    });
  }

  let uid: string;
  let userName: string | null = null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    userName = decoded.name ?? null;
  } catch {
    return Response.json({ 
      title: "What will be your next story?",
      message: "Discover the world's best destinations.", 
      userName: null 
    });
  }

  const firstName = userName?.split(" ")[0] ?? null;

  // â”€â”€ 1. Fetch Travel History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let history: Array<{ destination: string }> = [];
  try {
    const snap = await adminDb
      .collection("travelLogs")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(5)
      .get();
      
    history = snap.docs.map(d => ({ destination: d.data().destination as string }));
  } catch (e) {
    // silent
  }
  
  // â”€â”€ 2. Fetch User Index â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const userIndexRef = adminDb.collection("userIndex").doc(uid);
  let userIndexData: any = {};
  try {
    const userIndexSnap = await userIndexRef.get();
    if (userIndexSnap.exists) {
      userIndexData = userIndexSnap.data() || {};
    } else {
      // INITIALIZE COLLECTION IF MISSING
      await userIndexRef.set({ uid, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  } catch (e) {
    console.error("[Concierge GET] Failed to fetch/create userIndex", e);
  }

  const recentSearches: string[] = userIndexData.recentSearches || [];
  const defaultLocation = userIndexData.defaultLocation || userIndexData.defaultAddress || "";

  // â”€â”€ FIRST LOAD EXPERIENCE: Require Location â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!defaultLocation) {
    return Response.json({ 
      title: "What will be your next story?",
      message: `Welcome, ${firstName || "Traveler"}. To begin your journey and receive your personalized concierge experience, please set your default location.`, 
      userName: firstName,
      needsInitialization: true, // Tell frontend to show ONLY the "Set Default Address" button
      tags: []
    });
  }

  const weatherContext = await fetchWeather(defaultLocation);

  const cities = [...new Set([...history.map(h => h.destination), ...recentSearches])].filter(Boolean);

  // â”€â”€ 3. Prompt for the Concierge Welcome Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const prompt = `You are an exclusive, highly attentive travel concierge. 
The user named ${firstName || "Traveler"} is currently located at: ${defaultLocation}.
Current real-time weather there: ${weatherContext}.
They have recently explored or searched for: ${cities.length > 0 ? cities.join(", ") : "various places"}.

Write a personalized welcome message of around 50 words. 
Style: Concierge, elegant, honest, and inspiring.
Acknowledge their current location. Mention the weather and give an educated guess on the current Air Quality Index (AQI) (e.g. "Crisp, clear air" or "A bit hazy today") based on the city and weather.
Include the exact phrase: "What will be your next story?" either at the beginning or the end.
Output ONLY the message text without quotes or labels.`;

  let message = "What will be your next story? The world is full of untold chapters waiting for you.";
  let generatedTags: string[] = [];

  if (ai) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
      });
      message = (result.text ?? "").trim().replace(/^["']|["']$/g, "");
      
      // Generate user AI tags profile
      const tagPrompt = `Based on a traveler living in ${defaultLocation} and interested in: ${cities.join(", ") || "world travel"}, generate 3 to 5 single-word travel style tags (e.g., Urban, Nature, Historic). Output ONLY a valid JSON array of strings.`;
      const tagResult = await ai.models.generateContent({
         model: "gemini-3.1-flash-lite",
         contents: tagPrompt,
      });
      
      try {
         const parsed = extractJSON(tagResult.text ?? "") as string[];
         if (Array.isArray(parsed)) generatedTags = parsed;
      } catch (e) {
         console.error("[Concierge GET] Tag extraction failed");
      }
    } catch (err) {
      console.error("[Concierge GET] AI Generation failed", err);
    }
  }

  // â”€â”€ 4. Save RAG Context to userIndex â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ragContext = `User ${firstName || "Traveler"} prefers ${generatedTags.join(", ")}. Visited/Searched: ${cities.join(", ")}. Base Location: ${defaultLocation}.`;

  try {
    await userIndexRef.set({
      uid,
      tags: generatedTags.length > 0 ? generatedTags : (userIndexData.tags || []),
      welcomeReply: message,
      ragContext,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("[Concierge GET] Failed to update userIndex", e);
  }

  return Response.json({ title: "What will be your next story?", message, userName: firstName, tags: generatedTags, needsInitialization: false, defaultLocation });
}

// POST /api/home-welcome
// Call this endpoint when the user searches for a new city or updates their default location.
// It adds the searched city to the circular queue (max 5) on the userIndex collection.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const searchedCity = typeof body.searchedCity === "string" ? body.searchedCity.trim() : "";
  const defaultLocation = typeof body.defaultLocation === "string" ? body.defaultLocation.trim() : null;
  const defaultAddress = typeof body.defaultAddress === "string" ? body.defaultAddress.trim() : null;
  const savedDestination = body.savedDestination as Record<string, unknown> | null;

  if (!searchedCity && !defaultLocation && !defaultAddress && !savedDestination) return Response.json({ error: "Provide data to update" }, { status: 400 });

  const userIndexRef = adminDb.collection("userIndex").doc(uid);
  
  try {
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(userIndexRef);
      const data = snap.exists ? snap.data() || {} : {};
      const updates: any = { uid, updatedAt: FieldValue.serverTimestamp() };
      if (defaultLocation) updates.defaultLocation = defaultLocation;
      if (defaultAddress) updates.defaultAddress = defaultAddress;
      if (searchedCity) {
        updates.recentSearches = [searchedCity, ...(data.recentSearches || []).filter((c: string) => c.toLowerCase() !== searchedCity.toLowerCase())].slice(0, 5);
      }
      if (savedDestination) {
        updates.savedDestinations = [savedDestination, ...(data.savedDestinations || [])].slice(0, 5);
      }
      t.set(userIndexRef, { uid, ...updates }, { merge: true });
    });
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed to update userIndex" }, { status: 500 });
  }
}
