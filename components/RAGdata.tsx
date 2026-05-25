import { db } from "@/lib/firebase";
import { doc, setDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

export const writeRagData = async (userId: string, interactionType: string, data: any) => {
  if (!userId) return;
  const ragRef = doc(db, "ragData", userId);
  await setDoc(
    ragRef,
    {
      interactions: arrayUnion({
        type: interactionType,
        data,
        timestamp: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export default function RAGdata() {
  // Headless or placeholder component for RAG data
  return null;
}
