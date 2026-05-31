'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import storyData from '@/data/entireStory.json';

export async function checkUserStatus(uid: string) {
  try {
    if (!uid) return { exists: false, isAdmin: false };
    
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { exists: false, isAdmin: false };
    }
    const data = userDoc.data();
    return { 
      exists: true, 
      isAdmin: data?.isAdmin === true,
      data: JSON.parse(JSON.stringify(data)) // Serialize for client
    };
  } catch (error: any) {
    console.error('Error checking user status:', error);
    // Include the error code in the message to help debugging (e.g. 5 NOT_FOUND)
    const errorCode = error.code ? `[${error.code}] ` : '';
    throw new Error(`${errorCode}${error.message || 'Failed to check user status'}`);
  }
}

export async function saveUserProfile(uid: string, data: any) {
  try {
    await adminDb.collection('users').doc(uid).set({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to save user profile');
  }
}

export async function writeRagDataAction(userId: string, interactionType: string, data: any) {
  if (!userId) return;
  try {
    await adminDb.collection('ragData').doc(userId).set({
      interactions: FieldValue.arrayUnion({
        type: interactionType,
        data,
        timestamp: new Date().toISOString(),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error writing RAG data:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to write RAG data');
  }
}

export async function saveDialogueFlow(steps: any, userId: string | undefined) {
  try {
    await adminDb.collection('dialogueFlows').doc('main').set({
      steps,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving dialogue flow:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to save dialogue flow');
  }
}

export async function getDialogueFlow() {
  try {
    const flowDoc = await adminDb.collection('dialogueFlows').doc('main').get();
    if (flowDoc.exists) {
      return { exists: true, data: JSON.parse(JSON.stringify(flowDoc.data())) };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error fetching dialogue flow:', error);
    return { exists: false };
  }
}

export async function saveUserChoiceAction(uid: string, stepId: string, option: string) {
  try {
    await adminDb.collection('userSessions').doc(uid).set({
      flowId: 'main',
      history: FieldValue.arrayUnion({ stepId, option, timestamp: new Date().toISOString() }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving user choice:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to save user choice');
  }
}

export async function getStoryProgress(uid: string): Promise<{ page: number; time: number } | null> {
  try {
    if (!uid) return null;
    const doc = await adminDb.collection('progress').doc(uid).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      page: typeof data?.page === 'number' ? data.page : 0,
      time: typeof data?.time === 'number' ? data.time : 0,
    };
  } catch (error) {
    console.error('Error getting story progress:', error);
    return null;
  }
}

export async function saveStoryProgress(uid: string, page: number, time: number): Promise<void> {
  try {
    await adminDb.collection('progress').doc(uid).set({
      page,
      time,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error saving story progress:', error);
  }
}

// ─── /story collection ───────────────────────────────────────────────────────

export interface StoryParagraph {
  id: number;
  slug: string;
  title: string;
  text: string;
  audio: string;
  mood: string;
  options: string[];
}

/**
 * Loads /story/{storyId} from Firestore.
 * If the document doesn't exist, seeds it from the local JSON and returns the result.
 */
export async function getOrInitStory(storyId: string): Promise<{ paragraphs: StoryParagraph[] }> {
  try {
    const ref = adminDb.collection('story').doc(storyId);
    const snap = await ref.get();

    if (snap.exists) {
      return { paragraphs: JSON.parse(JSON.stringify(snap.data()!.paragraphs)) };
    }

    // Seed from bundled JSON
    const raw = storyData as { meta: Record<string, unknown>; paragraphs: Array<Record<string, unknown>> };
    const paragraphs: StoryParagraph[] = raw.paragraphs.map((p) => ({
      id:    p.id    as number,
      slug:  p.slug  as string,
      title: p.title as string,
      text:  p.text  as string,
      // Normalise audio path — use para<id>.mp3 consistently
      audio: `/audio/para${p.id}.mp3`,
      mood:  (p.mood as string) ?? 'neutral',
      options: ['Continue', 'Reflect'],
    }));

    await ref.set({
      storyId,
      title:     (raw.meta?.title as string) ?? storyId,
      paragraphs,
      seededAt:  FieldValue.serverTimestamp(),
    });

    return { paragraphs };
  } catch (error) {
    console.error('Error loading/initialising story:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to load story');
  }
}

/**
 * Appends a story choice to /story/{storyId}/sessions/{userId}.
 * Non-fatal — errors are logged but not rethrown.
 */
export async function saveStoryChoice(
  userId: string,
  storyId: string,
  paraSlug: string,
  choice: string,
): Promise<void> {
  if (!userId) return;
  try {
    await adminDb
      .collection('story')
      .doc(storyId)
      .collection('sessions')
      .doc(userId)
      .set(
        {
          choices: FieldValue.arrayUnion({
            paraSlug,
            choice,
            timestamp: new Date().toISOString(),
          }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.error('Error saving story choice:', error);
  }
}
