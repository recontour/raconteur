'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
