import { type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const isDummyKey = !apiKey || apiKey.includes("your_actual");
const ai = !isDummyKey ? new GoogleGenAI({ apiKey }) : null;

// Activity category to search query mapper
const ACTIVITY_PROMPTS: Record<string, string> = {
  adventure: "outdoor adventure activities like hiking, rock climbing, zip-lining, bungee jumping, water sports",
  romance: "romantic date ideas like dinner spots, scenic viewpoints, sunset tours, couples spa, wine tasting",
  "whats-on": "live events happening today or this week like concerts, festivals, theater shows, sports events",
  food: "top-rated restaurants, food markets, culinary experiences, cooking classes, street food tours",
  culture: "museums, art galleries, historical sites, cultural performances, heritage tours, architecture walks",
};

interface ActivityData {
  id: string;
  title: string;
  description: string;
  place: {
    name: string;
    address: string;
    rating?: number;
    reviews?: number;
  };
  category: string;
  date: {
    when: string;
    nextEvent?: string;
  };
  thumbnail?: string;
  link?: string;
  context: {
    summary: string;
    whyRelevant: string;
    typical_duration: string;
  };
}

async function generateActivitySearchResult(
  category: string,
  city: string
): Promise<ActivityData[]> {
  if (!ai) {
    // Fallback mock data
    return generateMockActivities(category, city);
  }

  const categoryPrompt = ACTIVITY_PROMPTS[category] || category;
  const prompt = `You are a travel expert. Generate 5 top-rated ${categoryPrompt} activities/experiences in ${city}.

For EACH activity, respond with ONLY valid JSON (no markdown, no comments, just raw JSON array):
[
  {
    "id": "activity-1-${category}-${city.toLowerCase().replace(/\\s+/g, '-')}",
    "title": "Exact activity name",
    "description": "Brief compelling description (1-2 sentences)",
    "place": {
      "name": "Venue or Location Name",
      "address": "Full address",
      "rating": 4.5,
      "reviews": 1234
    },
    "category": "${category}",
    "date": {
      "when": "When it's available (e.g., 'Daily 9AM-5PM' or 'Every Saturday')",
      "nextEvent": "ISO timestamp of next occurrence"
    },
    "link": "Website or booking link",
    "context": {
      "summary": "What makes this special and why locals love it",
      "whyRelevant": "Why a traveler interested in ${categoryPrompt} should visit",
      "typical_duration": "e.g., '2-3 hours'"
    }
  }
]

Ensure all 5 activities are real, distinct, and highly rated. Make dates realistic.`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    const responseText = result.text ?? "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return generateMockActivities(category, city);
    }

    const activities: ActivityData[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(activities)) return generateMockActivities(category, city);
    // Strip thumbnails — Gemini hallucinates image URLs that don't exist
    return activities.slice(0, 5).map((a) => ({ ...a, thumbnail: undefined }));
  } catch (err) {
    console.error("[activity-search] AI generation failed:", err);
    return generateMockActivities(category, city);
  }
}

function generateMockActivities(category: string, city: string): ActivityData[] {
  const mocks: Record<string, ActivityData[]> = {
    adventure: [
      {
        id: `activity-1-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Mountain Hiking Trail near ${city}`,
        description: "Popular hiking route with scenic views, perfect for all skill levels",
        place: { name: "Mountain Park", address: `${city}, Region`, rating: 4.6, reviews: 342 },
        category: "adventure",
        date: { when: "Daily, dawn to dusk", nextEvent: new Date().toISOString() },
        thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
        link: "#",
        context: {
          summary: "Well-maintained trail with breathtaking valley views",
          whyRelevant: "Perfect for adventure seekers and nature photographers",
          typical_duration: "3-4 hours",
        },
      },
    ],
    food: [
      {
        id: `activity-1-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Local Food Market in ${city}`,
        description: "Fresh produce and artisan foods at the city's most beloved market",
        place: { name: "City Market", address: `${city}, Region`, rating: 4.7, reviews: 521 },
        category: "food",
        date: { when: "Saturday & Sunday 8AM-2PM", nextEvent: new Date().toISOString() },
        thumbnail: "https://images.unsplash.com/photo-1555939594-58d7cb561ef1?w=400",
        link: "#",
        context: {
          summary: "Authentic local market featuring seasonal produce and specialty foods",
          whyRelevant: "Experience local food culture and meet local producers",
          typical_duration: "1.5-2 hours",
        },
      },
    ],
    culture: [
      {
        id: `activity-1-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Art Museum in ${city}`,
        description: "World-class contemporary and classical art collection",
        place: { name: "Modern Art Museum", address: `${city}, Region`, rating: 4.8, reviews: 892 },
        category: "culture",
        date: { when: "Daily 10AM-6PM, closed Mondays", nextEvent: new Date().toISOString() },
        thumbnail: "https://images.unsplash.com/photo-1578321272176-8d149ba5a0f8?w=400",
        link: "#",
        context: {
          summary: "Curated collection spanning centuries of artistic expression",
          whyRelevant: "Immerse yourself in local and international art",
          typical_duration: "2-3 hours",
        },
      },
    ],
    romance: [
      {
        id: `activity-1-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Sunset Dinner with a View in ${city}`,
        description: "Intimate dining experience with panoramic city/nature views",
        place: { name: "Rooftop Restaurant", address: `${city}, Region`, rating: 4.9, reviews: 623 },
        category: "romance",
        date: { when: "Daily dinner service 6PM-11PM", nextEvent: new Date().toISOString() },
        thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
        link: "#",
        context: {
          summary: "Romantic setting with fine cuisine and stunning vistas",
          whyRelevant: "Perfect for special occasions and memorable moments",
          typical_duration: "2.5-3 hours",
        },
      },
    ],
    "whats-on": [
      {
        id: `activity-1-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Live Music Festival in ${city}`,
        description: "Annual festival featuring local and international artists",
        place: { name: "City Center Stage", address: `${city}, Region`, rating: 4.5, reviews: 1043 },
        category: "whats-on",
        date: { when: "May 15-17, various times", nextEvent: new Date().toISOString() },
        thumbnail: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400",
        link: "#",
        context: {
          summary: "Celebration of live music with diverse genres and performers",
          whyRelevant: "Experience the vibrant local music scene",
          typical_duration: "2-4 hours per session",
        },
      },
    ],
  };

  // Return 5 mock activities for the category, or generic ones if not found
  const categoryActivities = mocks[category] || mocks.culture;
  return [
    categoryActivities[0],
    { ...categoryActivities[0], id: `activity-2-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`, title: categoryActivities[0].title + " - Alternative" },
    { ...categoryActivities[0], id: `activity-3-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`, title: categoryActivities[0].title + " - Premium" },
    { ...categoryActivities[0], id: `activity-4-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`, title: categoryActivities[0].title + " - Guided Tour" },
    { ...categoryActivities[0], id: `activity-5-${category}-${city.toLowerCase().replace(/\s+/g, '-')}`, title: categoryActivities[0].title + " - Workshop" },
  ];
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const limit = Math.min(typeof body.limit === "number" ? body.limit : 5, 10);

  if (!category || !city) {
    return Response.json(
      { error: "category and city are required" },
      { status: 400 }
    );
  }

  try {
    const activities = await generateActivitySearchResult(category, city);
    const results = activities.slice(0, limit);

    // Log this search to userIndex for analytics
    const userIndexRef = adminDb.collection("userIndex").doc(uid);
    await userIndexRef.set(
      {
        uid,
        lastActivitySearch: { category, city, timestamp: FieldValue.serverTimestamp() },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({
      category,
      city,
      activities: results,
      count: results.length,
    });
  } catch (err) {
    console.error("[activity-search POST] Error:", err);
    return Response.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
