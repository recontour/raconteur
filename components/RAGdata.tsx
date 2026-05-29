import { writeRagDataAction } from "@/app/actions/user";

export const writeRagData = async (userId: string, interactionType: string, data: any) => {
  await writeRagDataAction(userId, interactionType, data);
};

export default function RAGdata() {
  // Headless or placeholder component for RAG data
  return null;
}
