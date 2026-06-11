import { adminDb } from "@/lib/firebase-admin";
import type { DiaryScene } from "@/lib/types";
import diaryData from "@/data/diary.json";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProgressEntry {
  sceneId?: string;
  adminUid?: string;
  prompt?: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
  parsedScene?: unknown;
  error?: string;
  model: string;
  durationMs?: number;
  createdAt: string;
}

// ─── Diary ─────────────────────────────────────────────────────────────────────

/**
 * Load a scene from Firestore diary collection.
 * Falls back to diary.json seed, then to a placeholder if neither exists.
 */
export async function checkDiary(sceneId: string): Promise<DiaryScene> {
  try {
    const doc = await adminDb.collection("diary").doc(sceneId).get();
    if (doc.exists) return doc.data() as DiaryScene;
  } catch {
    // fall through to seed
  }

  const seedScene = (diaryData.scenes as DiaryScene[]).find((s) => s.id === sceneId);
  if (seedScene) return seedScene;

  // Ultimate fallback — placeholder so navigation never hard-breaks
  return {
    id: sceneId,
    heroMessage: "Coming soon. Check back later.",
    options: [{ label: "\u2190 Back", type: "back" }],
    generatedBy: "seed",
    updatedAt: new Date().toISOString(),
  };
}

export async function saveToDiary(sceneId: string, data: Partial<DiaryScene>): Promise<void> {
  await adminDb
    .collection("diary")
    .doc(sceneId)
    .set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Idempotent seed — only writes scenes that don't already exist in Firestore.
 * Safe to call on every deploy.
 */
export async function seedDiary(): Promise<{ seeded: string[]; skipped: string[] }> {
  const seeded: string[] = [];
  const skipped: string[] = [];

  for (const scene of diaryData.scenes as DiaryScene[]) {
    const doc = await adminDb.collection("diary").doc(scene.id).get();
    if (doc.exists) {
      skipped.push(scene.id);
    } else {
      await adminDb.collection("diary").doc(scene.id).set({
        ...scene,
        generatedBy: "seed",
        updatedAt: new Date().toISOString(),
      });
      seeded.push(scene.id);
    }
  }

  const versionDoc = await adminDb.collection("config").doc("version").get();
  if (!versionDoc.exists) {
    await adminDb.collection("config").doc("version").set({
      diaryVersion: diaryData.version,
      updatedAt: new Date().toISOString(),
    });
  }

  return { seeded, skipped };
}

export async function getDiaryVersion(): Promise<number> {
  try {
    const doc = await adminDb.collection("config").doc("version").get();
    if (!doc.exists) return 0;
    return (doc.data()?.diaryVersion as number) ?? 0;
  } catch {
    return 0;
  }
}

// ─── Progress ──────────────────────────────────────────────────────────────────

/** Raw dump of every API call — request, response, error. Nothing filtered. */
export async function saveToProgress(entry: ProgressEntry): Promise<string> {
  const ref = await adminDb.collection("progress").add({
    ...entry,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  });
  return ref.id;
}

export async function updateProgress(
  progressId: string,
  data: Partial<ProgressEntry>,
): Promise<void> {
  await adminDb.collection("progress").doc(progressId).set(data, { merge: true });
}
