'use server';

import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
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
    const ref = adminDb.collection('entireStory').doc(storyId);
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

/**
 * Moves the local entireStory.json data to the Firestore collection 'entireStory'
 * for a document with the given UID.
 */
export async function moveStoryJsonToDb(uid: string) {
  try {
    if (!uid) throw new Error('Document UID is required');

    const docRef = adminDb.collection('entireStory').doc(uid);
    const docSnap = await docRef.get();

    // Only add to the DB if the document doesn't already exist
    if (!docSnap.exists) {
      const raw = storyData as { meta: Record<string, unknown>; paragraphs: Array<Record<string, unknown>> };
      const paragraphs: StoryParagraph[] = raw.paragraphs.map((p) => ({
        id:    p.id    as number,
        slug:  p.slug  as string,
        title: p.title as string,
        text:  p.text  as string,
        audio: `/audio/para${p.id}.mp3`,
        mood:  (p.mood as string) ?? 'neutral',
        options: ['Continue', 'Reflect'],
      }));

      await docRef.set({
        storyId: uid,
        title: (raw.meta?.title as string) ?? uid,
        paragraphs,
        migratedAt: FieldValue.serverTimestamp(),
      });
    }

    // Revalidate the path where your story is displayed
    revalidatePath('/book');

    return { success: true, uid };
  } catch (error: any) {
    console.error('Error moving story JSON to Firestore:', error);
    throw new Error(error.message || 'Failed to move story data');
  }
}

// ─── Anonymous session tracking ──────────────────────────────────────────────

export async function createAnonSession(anonId: string, ua: string, userId?: string | null): Promise<void> {
  // Log to your server terminal so you can verify the data is arriving
  console.log(`[SessionTracker] Processing session: ${anonId} | User: ${userId || 'Anonymous'}`);

  try {
    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Parse the UA string into separate, readable fields
    const isMobile = /mobile/i.test(ua);
    const device = isMobile ? (/iPhone|iPad|iPod/.test(ua) ? 'iPhone' : 'Android') : 'Desktop';
    
    // Order is important: many mobile browsers include "Safari" in the string
    const browser = /edg/i.test(ua) ? 'Edge' :
                    /chrome|crios/i.test(ua) ? 'Chrome' : 
                    /safari/i.test(ua) ? 'Safari' : 
                    /firefox/i.test(ua) ? 'Firefox' : 'Other';

    const sessionData = {
      anonId,
      ip,
      ua,
      device,   // Saved separately as requested
      browser,  // Saved separately as requested
      lastSeen: FieldValue.serverTimestamp(),
      userId: userId || null,
    };

    const sessionRef = adminDb.collection('sessions').doc(anonId);
    
    // Use set with merge: true to ensure device/browser fields are added 
    // even if the document was created previously without them.
    await sessionRef.set({
      ...sessionData,
      // If it's a new doc, set firstSeen. If existing, it stays.
      firstSeen: FieldValue.serverTimestamp(), 
      visits: FieldValue.increment(1),
    }, { merge: true });

    if (userId) {
      // Save a "map" of the current session directly to the user document
      await adminDb.collection('users').doc(userId).set({
        lastSessionId: anonId,
        sessionIds:    FieldValue.arrayUnion(anonId),
        updatedAt:     FieldValue.serverTimestamp(),
        currentSession: {
          device,
          browser,
        }
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error creating anon session:', error);
  }
}

// ─── Phone user upsert ───────────────────────────────────────────────────────

export async function upsertPhoneUser(
  uid: string,
  phone: string,
): Promise<{ name: string | null }> {
  const ref  = adminDb.collection('users').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      uid,
      phone,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { name: null };
  }

  await ref.update({ phone, updatedAt: FieldValue.serverTimestamp() });
  return { name: (snap.data()?.name as string | undefined) ?? null };
}

// ─── Google auth log ─────────────────────────────────────────────────────────

export async function saveGoogleAuthLog(
  uid: string,
  data: {
    displayName: string | null;
    email:       string | null;
    photoURL:    string | null;
    providerId:  string;
  },
): Promise<void> {
  try {
    await adminDb.collection('logs').doc(uid).set(
      { ...data, uid, savedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    if (data.displayName) {
      const parts     = data.displayName.trim().split(/\s+/);
      const firstName = parts[0] ?? '';
      const lastName  = parts.slice(1).join(' ') || '';
      await adminDb.collection('users').doc(uid).set(
        {
          firstName,
          lastName,
          displayName: data.displayName,
          email:       data.email,
          photoURL:    data.photoURL,
          googleLinked: true,
          updatedAt:   FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (error) {
    console.error('Error saving Google auth log:', error);
  }
}

// ─── Welcome text (loaded from /config/welcome, cached client-side) ────────────

export async function getWelcomeText(): Promise<string> {
  try {
    const snap = await adminDb.collection('config').doc('welcome').get();
    if (snap.exists) {
      const text = snap.data()?.text as string | undefined;
      if (text?.trim()) return text.trim();
    }
  } catch (e) {
    console.error('getWelcomeText failed:', e);
  }
  return 'What would you like to do today?';
}
