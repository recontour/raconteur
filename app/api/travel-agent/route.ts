import { type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const isDummyKey = !apiKey || apiKey.includes("your_actual");
const ai = !isDummyKey ? new GoogleGenAI({ apiKey }) : null;

const FALLBACK_TITLE = "What will be your next story?";

function cleanModelText(text: string | null | undefined): string {
  const cleaned = (text ?? "").trim().replace(/^["']|["']$/g, "");
  return cleaned || `${FALLBACK_TITLE} The world is full of untold chapters waiting for you.`;
}

async function generateWelcomeMessage(input: {
  firstName: string | null;
  defaultLocation: string;
  cities: string[];
}): Promise<string> {
  const { firstName, defaultLocation, cities } = input;

  if (!ai) {
    if (defaultLocation) {
      return `${FALLBACK_TITLE} Welcome${firstName ? `, ${firstName}` : ""}. You are in ${defaultLocation} today, and your next journey is ready whenever you are.`;
    }
    return `${FALLBACK_TITLE} Welcome${firstName ? `, ${firstName}` : ""}. Set your home location to unlock a more personal concierge experience.`;
  }

  const prompt = `You are an exclusive, attentive travel concierge.\nWrite one short welcome message around 40-60 words.\nInclude the exact phrase: "What will be your next story?"\nUser name: ${firstName || "Traveler"}\nDefault location: ${defaultLocation || "Unknown"}\nRecent cities: ${cities.length > 0 ? cities.join(", ") : "None"}\nTone: elegant, warm, concise.\nOutput only the final message text.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });
    return cleanModelText(result.text);
  } catch (err) {
    console.error("[travel-agent GET] AI generation failed", err);
    if (defaultLocation) {
      return `${FALLBACK_TITLE} Welcome${firstName ? `, ${firstName}` : ""}. You are in ${defaultLocation}, and we can shape your next plan from here.`;
    }
    return `${FALLBACK_TITLE} Welcome${firstName ? `, ${firstName}` : ""}. Set your home location to unlock a more personal concierge experience.`;
  }
}

// GET /api/travel-agent
// Message flow: read userIndex welcomeReply first, generate+save only if missing.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return Response.json({ 
      title: FALLBACK_TITLE,
      message: "Discover the world's best destinations.",
      userName: null,
      defaultLocation: "",
      needsInitialization: true,
      tags: []
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
      title: FALLBACK_TITLE,
      message: "Discover the world's best destinations.",
      userName: null,
      defaultLocation: "",
      needsInitialization: true,
      tags: []
    });
  }

  const firstName = userName?.split(" ")[0] ?? null;

  const userIndexRef = adminDb.collection("userIndex").doc(uid);
  let userIndexData: Record<string, unknown> = {};
  try {
    const userIndexSnap = await userIndexRef.get();
    if (userIndexSnap.exists) {
      userIndexData = userIndexSnap.data() || {};
    } else {
      await userIndexRef.set({ uid, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  } catch (e) {
    console.error("[travel-agent GET] Failed to fetch/create userIndex", e);
  }

  const recentSearches = Array.isArray(userIndexData.recentSearches)
    ? (userIndexData.recentSearches as string[]).filter((v): v is string => typeof v === "string")
    : [];
  const tags = Array.isArray(userIndexData.tags)
    ? (userIndexData.tags as string[]).filter((v): v is string => typeof v === "string")
    : [];
  const defaultLocation =
    (typeof userIndexData.defaultLocation === "string" && userIndexData.defaultLocation.trim()) ||
    (typeof userIndexData.defaultAddress === "string" && userIndexData.defaultAddress.trim()) ||
    "";

  const existingMessage =
    typeof userIndexData.welcomeReply === "string" ? userIndexData.welcomeReply.trim() : "";

  if (existingMessage) {
    return Response.json({
      title: FALLBACK_TITLE,
      message: existingMessage,
      userName: firstName,
      tags,
      needsInitialization: !defaultLocation,
      defaultLocation,
    });
  }

  let history: Array<{ destination: string }> = [];
  try {
    const snap = await adminDb
      .collection("travelLogs")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(5)
      .get();

    history = snap.docs.map((d) => ({ destination: d.data().destination as string }));
  } catch {
    // non-fatal: missing history should not block message generation
  }

  const cities = [...new Set([...history.map((h) => h.destination), ...recentSearches])]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, 8);

  const message = await generateWelcomeMessage({
    firstName,
    defaultLocation,
    cities,
  });

  try {
    await userIndexRef.set({
      uid,
      welcomeReply: message,
      tags,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("[travel-agent GET] Failed to update userIndex", e);
  }

  return Response.json({
    title: FALLBACK_TITLE,
    message,
    userName: firstName,
    tags,
    needsInitialization: !defaultLocation,
    defaultLocation,
  });
}

// POST /api/travel-agent
// Handles:
// - City/location updates
// - Activity selection (with rotational deletion for max 10)
// - Chat modes
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
  const mode = typeof body.mode === "string" ? body.mode : "location";

  // ── Mode: add-activity ─────────────────────────────────────────────────────
  // Add an activity to selectedActivities with max 10 using rotational deletion
  if (mode === "add-activity") {
    const activityId = typeof body.activityId === "string" ? body.activityId : "";
    const category = typeof body.category === "string" ? body.category : "";
    const city = typeof body.city === "string" ? body.city : "";
    const activityData = body.activityData as Record<string, unknown> | null;

    if (!activityId || !category || !city || !activityData) {
      return Response.json({ error: "activityId, category, city, and activityData required" }, { status: 400 });
    }

    const userIndexRef = adminDb.collection("userIndex").doc(uid);

    try {
      const result = await adminDb.runTransaction(async (t) => {
        const snap = await t.get(userIndexRef);
        const data = snap.exists ? snap.data() || {} : {};
        
        const selectedActivities = Array.isArray(data.selectedActivities)
          ? (data.selectedActivities as Record<string, unknown>[])
          : [];

        // Remove if already exists (to update timestamp)
        const filtered = selectedActivities.filter((a) => a.id !== activityId);

        // Add new activity to front
        const updated = [
          {
            id: activityId,
            title: activityData.title,
            category,
            city,
            addedAt: Date.now(),
            context: activityData.context,
            link: activityData.link,
            place: activityData.place,
          },
          ...filtered,
        ].slice(0, 10); // Max 10 with rotational deletion

        // Create activity cache context for RAG
        const cacheKey = `activity-${activityId}-chat`;
        const summary = typeof activityData.context === "object" && activityData.context !== null
          ? (activityData.context as Record<string, unknown>).summary
          : "";
        const title = activityData.title;

        const systemPrompt = `User is interested in "${title}" in ${city} (category: ${category}). They want to explore this activity. You're a knowledgeable travel guide who can answer questions about: timing, how to get there, what to bring, cost, best practices, related activities, local tips, and safety. Reference the cached activity context when relevant.`;

        t.set(
          userIndexRef,
          {
            uid,
            selectedActivities: updated,
            [`activityCache_${cacheKey}`]: {
              key: cacheKey,
              activityId,
              title,
              category,
              city,
              summary: summary || "",
              systemPrompt,
              createdAt: FieldValue.serverTimestamp(),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { selectedActivities: updated, cacheKey };
      });

      return Response.json({
        success: true,
        selectedActivities: result.selectedActivities,
        totalSelected: result.selectedActivities.length,
        maxCapacity: 10,
        chatContext: {
          cacheKey: result.cacheKey,
        },
      });
    } catch (err) {
      console.error("[travel-agent POST add-activity]", err);
      return Response.json({ error: "Failed to add activity" }, { status: 500 });
    }
  }

  // ── Mode: add-interest ────────────────────────────────────────────────────
  // Save an interest/category tag to userIndex.interests for RAG profiling
  if (mode === "add-interest") {
    const interest = typeof body.interest === "string" ? body.interest.trim() : "";
    if (!interest) return Response.json({ error: "interest required" }, { status: 400 });

    const ref = adminDb.collection("userIndex").doc(uid);
    try {
      await ref.set(
        {
          uid,
          interests: FieldValue.arrayUnion(interest),
          [`interestTaps.${interest}`]: FieldValue.increment(1),
          lastInterestAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return Response.json({ success: true });
    } catch (err) {
      console.error("[travel-agent POST add-interest]", err);
      return Response.json({ error: "Failed to save interest" }, { status: 500 });
    }
  }

  // ── Mode: location ─────────────────────────────────────────────────────────
  // Original location/search handling
  const searchedCity = typeof body.searchedCity === "string" ? body.searchedCity.trim() : "";
  const defaultLocation = typeof body.defaultLocation === "string" ? body.defaultLocation.trim() : null;
  const defaultAddress = typeof body.defaultAddress === "string" ? body.defaultAddress.trim() : null;
  const savedDestination = body.savedDestination as Record<string, unknown> | null;

  if (!searchedCity && !defaultLocation && !defaultAddress && !savedDestination) {
    return Response.json({ error: "Provide data to update" }, { status: 400 });
  }

  const userIndexRef = adminDb.collection("userIndex").doc(uid);

  try {
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(userIndexRef);
      const data = snap.exists ? snap.data() || {} : {};
      const updates: any = { uid, updatedAt: FieldValue.serverTimestamp() };
      if (defaultLocation) {
        updates.defaultLocation = defaultLocation;
        updates.welcomeReply = FieldValue.delete(); // force message regeneration with new location
      }
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
