import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { google } from "@ai-sdk/google"; // <--- CHANGED THIS
import { NextResponse } from "next/server";

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60;

export async function POST(req: Request) {
  console.log("--- API CALLED: generate-story (Gemini) ---");

  // Safety Checks
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase Service Key" },
      { status: 500 }
    );
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: "Missing Google API Key" },
      { status: 500 }
    );
  }

  try {
    const { userId, previousNodeId, choiceLabel, genre } = await req.json();

    // 1. Fetch Context
    let contextPrompt = "";
    let chapterNum = 1;
    let pageNum = 1;

    if (previousNodeId) {
      const { data: prevNode } = await supabaseAdmin
        .from("story_nodes")
        .select("*")
        .eq("id", previousNodeId)
        .single();

      if (prevNode) {
        contextPrompt = `
          PREVIOUS SCENE: "${prevNode.content}"
          USER ACTION: The user chose to "${choiceLabel}".
        `;
        chapterNum = prevNode.chapter_number;
        pageNum = prevNode.page_number + 1;
      }
    } else {
      contextPrompt = contextPrompt = `START OF STORY: ${
        genre || "The detective arrives at the crime scene."
      }`;
    }

    // 2. System Prompt
    const systemPrompt = `
      You are a gritty, noir detective story writer.
      
      RULES:
      1. Write in the second person ("You walk into the room...").
      2. Keep it atmospheric, cynical, and descriptive.
      3. Length: Approx 100-150 words.
      4. Provide exactly 2 distinct choices.
      
      OUTPUT FORMAT (JSON):
      {
        "content": "Story text...",
        "choices": [{ "label": "...", "intent": "..." }, { "label": "...", "intent": "..." }],
        ${
          !previousNodeId
            ? '"title": "Generate a short, punchy title for this specific story (max 5 words)",'
            : ""
        } 
      }
    `;

    // 3. Call Gemini
    // We use 'gemini-1.5-flash' because it is fast and free-tier eligible.
    const { text } = await generateText({
      model: google("gemini-2.5-flash"), // <--- CHANGED THIS
      system: systemPrompt,
      prompt: `Generate the next part of the story.\n${contextPrompt}`,
      temperature: 0.7,
    });

    // 4. Parse & Save (Same as before)
    const cleanJson = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const storyData = JSON.parse(cleanJson);

    const { data: newNode, error: nodeError } = await supabaseAdmin
      .from("story_nodes")
      .insert({
        content: storyData.content,
        chapter_number: chapterNum,
        page_number: pageNum,
        parent_node_id: previousNodeId || null,
        choice_label: choiceLabel || "Start",
        choices: storyData.choices, // <--- ADD THIS LINE
      })
      .select()
      .single();

    if (nodeError) throw new Error(`DB Error: ${nodeError.message}`);

    // Update Progress
    await supabaseAdmin.from("user_progress").upsert({
      user_id: userId,
      current_node_id: newNode.id,
      // If the AI returned a title, save it. Otherwise, keep existing title (don't overwrite with null)
      ...(storyData.title && { story_title: storyData.title }),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      node: newNode,
      choices: storyData.choices,
      title: storyData.title,
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
