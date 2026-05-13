import { type NextRequest } from "next/server";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type OptionNode = {
  id: string;
  label: string;
};

type BranchPayload = {
  message: string;
  options: OptionNode[];
};

type BranchRequestBody = {
  mode?: "init" | "branch";
  sessionId?: string;
  city?: string;
  topic?: string;
  parentPathId?: string;
  optionId?: string;
  optionLabel?: string;
  intake?: {
    travelDates?: string;
    destination?: string;
    budget?: string;
    travelers?: string;
    preferences?: string | string[];
  };
  proposalApproved?: boolean;
  bookingApproved?: boolean;
};

type WorkflowStage = 1 | 2 | 3;

type WorkflowSnapshot = {
  stage: WorkflowStage;
  missingFields: string[];
  inquiry: {
    travelDates: string;
    destination: string;
    budget: string;
    travelers: string;
    preferences: string;
  };
  proposalApproved: boolean;
};

const MAX_MESSAGE_CHARS = 300;

const GEMINI_MODEL = (process.env.GEMINI_TRAVELMASTER_MODEL || "gemini-3.1-flash-lite-preview").trim();
const ai = genkit({ plugins: [googleAI()] });

const INITIAL_OPTIONS: OptionNode[] = [
  { id: "adventure", label: "Adventure" },
  { id: "food-drink", label: "Food & Drink" },
  { id: "culture", label: "Culture" },
  { id: "nature", label: "Nature" },
  { id: "nightlife", label: "Nightlife" },
  { id: "wellness", label: "Wellness" },
];

const FALLBACK_BRANCHES: Record<string, BranchPayload> = {
  adventure: {
    message:
      "Adventure in this city feels like a heartbeat you can follow. Chase a sunrise trail, slip into a hidden cove, and pick one bold moment that will become your favorite story from this trip.",
    options: [
      { id: "sunrise-trails", label: "Sunrise trails" },
      { id: "water-rush", label: "Water rush" },
      { id: "urban-challenges", label: "Urban challenges" },
      { id: "daytrip-quests", label: "Day-trip quests" },
    ],
  },
  "food-drink": {
    message:
      "Food and drink reveal a city from the inside out. Start with one classic, then chase a local favorite, and end where conversation stays longer than the plates.",
    options: [
      { id: "signature-bites", label: "Signature bites" },
      { id: "street-flavors", label: "Street flavors" },
      { id: "hidden-cafes", label: "Hidden cafes" },
      { id: "late-night-tables", label: "Late-night tables" },
    ],
  },
  culture: {
    message:
      "Culture is the city speaking in many voices. Let museums set the context, neighborhoods add texture, and a small evening performance turn the day into memory.",
    options: [
      { id: "museum-route", label: "Museum route" },
      { id: "heritage-walks", label: "Heritage walks" },
      { id: "galleries-now", label: "Galleries now" },
      { id: "live-arts", label: "Live arts" },
    ],
  },
};

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function ensureFourOptions(options: OptionNode[], seed: string): OptionNode[] {
  const deduped = new Map<string, OptionNode>();

  for (const raw of options) {
    const label = String(raw.label || "").trim();
    if (!label) continue;
    const id = normalizeId(raw.id || label);
    if (!id || deduped.has(id)) continue;
    deduped.set(id, { id, label: label.slice(0, 50) });
    if (deduped.size >= 4) break;
  }

  const fallbackLabels = ["Local favorites", "Iconic spots", "Hidden gems", "One-day plan"];
  let i = 0;
  while (deduped.size < 4) {
    const label = fallbackLabels[i] || `Option ${i + 1}`;
    const id = normalizeId(`${seed}-${label}-${i}`);
    if (!deduped.has(id)) deduped.set(id, { id, label });
    i += 1;
  }

  return [...deduped.values()].slice(0, 4);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function asCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toPreferences(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => asCleanString(v))
      .filter(Boolean)
      .join(", ");
  }
  return asCleanString(value);
}

function includesApprovalIntent(text: string): boolean {
  const value = text.toLowerCase();
  return /(approve|approved|book|booking|confirm|finalize|go-ahead|lets go)/.test(value);
}

function inferWorkflow(input: {
  city: string;
  optionId: string;
  optionLabel: string;
  body: BranchRequestBody;
  prior?: Partial<WorkflowSnapshot>;
}): WorkflowSnapshot {
  const priorInquiry = input.prior?.inquiry;
  const inquiry = {
    travelDates: asCleanString(input.body.intake?.travelDates) || asCleanString(priorInquiry?.travelDates),
    destination:
      asCleanString(input.body.intake?.destination) ||
      asCleanString(priorInquiry?.destination) ||
      asCleanString(input.city),
    budget: asCleanString(input.body.intake?.budget) || asCleanString(priorInquiry?.budget),
    travelers: asCleanString(input.body.intake?.travelers) || asCleanString(priorInquiry?.travelers),
    preferences:
      toPreferences(input.body.intake?.preferences) ||
      asCleanString(priorInquiry?.preferences) ||
      asCleanString(input.optionLabel),
  };

  const missingFields = [
    !inquiry.travelDates ? "travelDates" : "",
    !inquiry.destination ? "destination" : "",
    !inquiry.budget ? "budget" : "",
    !inquiry.travelers ? "travelers" : "",
    !inquiry.preferences ? "preferences" : "",
  ].filter(Boolean);

  const approvedByInput =
    input.body.proposalApproved === true ||
    input.body.bookingApproved === true ||
    includesApprovalIntent(`${input.optionId} ${input.optionLabel}`);

  const proposalApproved = Boolean(input.prior?.proposalApproved) || approvedByInput;

  let stage: WorkflowStage = 1;
  if (missingFields.length === 0) stage = 2;
  if (missingFields.length === 0 && proposalApproved) stage = 3;

  return {
    stage,
    missingFields,
    inquiry,
    proposalApproved,
  };
}

function buildWorkflowPrompt(snapshot: WorkflowSnapshot): string {
  return [
    "Travel flow (use only stages 1-3):",
    "1) Inquiry & Assessment: collect travelDates, destination, budget, travelers, preferences.",
    "2) Research & Proposal: propose flights/stay/activities with quote-ready direction.",
    "3) Approval & Booking: once approved, confirm booking kickoff and deposit/payment readiness.",
    `Current stage: ${snapshot.stage}`,
    `Missing inquiry fields: ${snapshot.missingFields.length ? snapshot.missingFields.join(", ") : "none"}`,
    `Collected inquiry data: ${JSON.stringify(snapshot.inquiry)}`,
    `Proposal approved: ${snapshot.proposalApproved ? "yes" : "no"}`,
    "Behavior:",
    "- If stage 1: ask for missing fields via 4 option labels.",
    "- If stage 2: give concise proposal direction and include one approval-oriented option.",
    "- If stage 3: confirm booking-start next steps and ask for final booking details.",
  ].join("\n");
}

function shorten(text: string, max = MAX_MESSAGE_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function buildOptionAwareMessage(input: {
  city: string;
  optionLabel: string;
  options: OptionNode[];
}): string {
  const labels = input.options.map((o) => o.label).slice(0, 4);
  const cityChunk = input.city ? ` in ${input.city}` : "";
  const selected = input.optionLabel ? ` You picked ${input.optionLabel}.` : "";
  const message = `Nice choice${cityChunk}.${selected} Want ${labels[0]}, ${labels[1]}, ${labels[2]}, or ${labels[3]}? Tap one and I will shape the next step.`;
  return shorten(cleanText(message));
}

function messageMentionsOptions(message: string, options: OptionNode[]): boolean {
  const lower = message.toLowerCase();
  return options.every((o) => lower.includes(o.label.toLowerCase()));
}

function finalizePayload(input: {
  city: string;
  optionLabel: string;
  payload: BranchPayload;
}): BranchPayload {
  const options = ensureFourOptions(input.payload.options, "branch");
  const baseMessage = shorten(cleanText(input.payload.message || ""));

  const message =
    baseMessage && messageMentionsOptions(baseMessage, options)
      ? baseMessage
      : buildOptionAwareMessage({ city: input.city, optionLabel: input.optionLabel, options });

  return {
    message,
    options,
  };
}

function parseJsonBlock(rawText: string): BranchPayload | null {
  const cleaned = rawText.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { message?: string; options?: Array<{ id?: string; label?: string }> };
    const message = cleanText(String(parsed.message || ""));
    const options = Array.isArray(parsed.options)
      ? parsed.options.map((o) => ({ id: normalizeId(String(o.id || o.label || "")), label: String(o.label || "").trim() }))
      : [];
    if (!message) return null;
    return { message: shorten(message), options: ensureFourOptions(options, "branch") };
  } catch {
    return null;
  }
}

function extractJson(text: string): BranchPayload | null {
  const direct = parseJsonBlock(text);
  if (direct) return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return parseJsonBlock(text.slice(start, end + 1));
  }
  return null;
}

async function maybeGetUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

function fallbackBranch(input: { optionId: string; optionLabel: string; city: string }): BranchPayload {
  const candidate = FALLBACK_BRANCHES[input.optionId] || {
    message: `${input.optionLabel} can unfold in beautiful layers. Start easy, then deepen with local detail, and save one detour for surprise.`,
    options: [
      { id: "quick-start", label: "Quick start" },
      { id: "best-timing", label: "Best timing" },
      { id: "local-secrets", label: "Local secrets" },
      { id: "mix-and-match", label: "Mix and match" },
    ],
  };

  const payload: BranchPayload = {
    message: candidate.message,
    options: ensureFourOptions(candidate.options, input.optionId || "branch"),
  };

  return finalizePayload({
    city: input.city,
    optionLabel: input.optionLabel,
    payload,
  });
}

async function generateBranch(input: {
  city: string;
  pathId: string;
  optionId: string;
  optionLabel: string;
  workflow: WorkflowSnapshot;
}): Promise<BranchPayload> {
  const workflowPrompt = buildWorkflowPrompt(input.workflow);

  const prompt = [
    "You are TravelMaster, an elite travel agent.",
    "Voice: smart, warm, slightly poetic, practical.",
    "Task: create one branching response for a travel click-flow.",
    `City context: ${input.city || "Unknown"}`,
    `Current branch path: ${input.pathId}`,
    `User clicked: ${input.optionLabel} (${input.optionId})`,
    workflowPrompt,
    "Rules:",
    "- message length: max 300 characters",
    "- make message conversational, vivid, and specific",
    "- return exactly 4 next options",
    "- option labels: 2-4 words each",
    "- avoid numbering in labels",
    "- message must naturally mention all 4 returned option labels",
    "Return ONLY strict JSON in this shape:",
    '{"message":"...","options":[{"id":"...","label":"..."},{"id":"...","label":"..."},{"id":"...","label":"..."},{"id":"...","label":"..."}]}'
  ].join("\n");

  try {
    const result = await ai.generate({
      model: GEMINI_MODEL,
      prompt,
    });

    const payload = extractJson(result.text ?? "");
    if (payload) {
      return finalizePayload({ city: input.city, optionLabel: input.optionLabel, payload });
    }
    return fallbackBranch({ optionId: input.optionId, optionLabel: input.optionLabel, city: input.city });
  } catch (err) {
    console.warn("[travel-master] Gemini generation failed", err);
    return fallbackBranch({ optionId: input.optionId, optionLabel: input.optionLabel, city: input.city });
  }
}

export async function POST(req: NextRequest) {
  const uid = await maybeGetUid(req);
  const body = (await req.json().catch(() => ({}))) as BranchRequestBody;
  const mode = body.mode || "branch";

  const city = typeof body.city === "string" ? body.city.trim() : "";
  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim()
    ? body.sessionId.trim()
    : crypto.randomUUID();

  const sessionRef = adminDb.collection("travelMaster").doc(sessionId);
  const sessionSnap = await sessionRef.get().catch(() => null);
  const sessionData = (sessionSnap?.exists ? sessionSnap.data() : {}) as {
    workflow?: Partial<WorkflowSnapshot>;
    tripId?: string;
  };

  if (mode === "init") {
    const workflow = inferWorkflow({
      city,
      optionId: "",
      optionLabel: "",
      body,
      prior: sessionData.workflow,
    });

    try {
      await sessionRef.set(
        {
          sessionId,
          uid: uid || null,
          city,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          rootOptions: INITIAL_OPTIONS,
          clicks: 0,
          workflow,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[travel-master] failed to initialize session", err);
    }

    return Response.json({
      sessionId,
      city,
      initialOptions: INITIAL_OPTIONS,
      workflow,
    });
  }

  const optionId = normalizeId(typeof body.optionId === "string" ? body.optionId : "");
  const optionLabel = (typeof body.optionLabel === "string" ? body.optionLabel : "").trim();
  const parentPathId = normalizeId(typeof body.parentPathId === "string" ? body.parentPathId : "root");

  if (!optionId || !optionLabel) {
    return Response.json({ error: "optionId and optionLabel are required" }, { status: 400 });
  }

  const workflow = inferWorkflow({
    city,
    optionId,
    optionLabel,
    body,
    prior: sessionData.workflow,
  });

  const pathId = parentPathId === "root" ? optionId : `${parentPathId}__${optionId}`;
  const stagePathId = `${pathId}__s${workflow.stage}`;
  const nodeRef = adminDb.collection("travelMasterTree").doc(stagePathId);

  let payload: BranchPayload | null = null;
  let source: "cache" | "ai" = "cache";

  try {
    const cached = await nodeRef.get();
    if (cached.exists) {
      const data = cached.data() as { message?: string; options?: OptionNode[] };
      const message = cleanText(String(data.message || ""));
      const options = Array.isArray(data.options) ? ensureFourOptions(data.options, pathId) : [];
      if (message && options.length === 4) {
        payload = finalizePayload({
          city,
          optionLabel,
          payload: { message, options },
        });
      }
    }
  } catch (err) {
    console.warn("[travel-master] cache read failed", err);
  }

  if (!payload) {
    source = "ai";
    payload = await generateBranch({ city, pathId: stagePathId, optionId, optionLabel, workflow });
    nodeRef
      .set(
        {
          pathId: stagePathId,
          logicalPathId: pathId,
          parentPathId,
          optionId,
          optionLabel,
          city,
          stage: workflow.stage,
          workflow,
          message: payload.message,
          options: payload.options,
          model: GEMINI_MODEL,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch((err: unknown) => console.warn("[travel-master] cache write failed", err));
  }

  sessionRef
    .set(
      {
        sessionId,
        uid: uid || null,
        city,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        lastPathId: pathId,
        clicks: FieldValue.increment(1),
        workflow,
      },
      { merge: true }
    )
    .catch((err: unknown) => console.warn("[travel-master] session write failed", err));

  let tripId: string | null = null;
  if (workflow.stage >= 3) {
    tripId = asCleanString(sessionData.tripId) || `trip_${crypto.randomUUID()}`;
    adminDb
      .collection("tripIndex")
      .doc(tripId)
      .set(
        {
          tripId,
          sessionId,
          uid: uid || null,
          city,
          workflow,
          approvedAt: workflow.proposalApproved ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch((err: unknown) => console.warn("[travel-master] trip write failed", err));

    sessionRef
      .set(
        {
          tripId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch((err: unknown) => console.warn("[travel-master] session tripId write failed", err));
  }

  sessionRef
    .collection("events")
    .add({
      type: "click",
      optionId,
      optionLabel,
      parentPathId,
      pathId,
      stage: workflow.stage,
      source,
      uid: uid || null,
      city,
      workflow,
      tripId,
      message: payload.message,
      options: payload.options,
      createdAt: FieldValue.serverTimestamp(),
    })
    .catch((err: unknown) => console.warn("[travel-master] event write failed", err));

  return Response.json({
    sessionId,
    pathId,
    parentPathId,
    stage: workflow.stage,
    workflow,
    tripId,
    source,
    message: payload.message,
    options: payload.options,
  });
}