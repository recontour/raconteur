import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { getDialogueFlow, saveUserChoiceAction } from "@/app/actions/user";
import { writeRagData } from "@/components/RAGdata";
import { RagDocument } from "@/components/Context";

export type FlowPhase = "WELCOME" | "HERO" | "AVATAR" | "STORY";

export interface DialogueStep {
  id: string;
  ai: string;
  options: string[];
  type: "row" | "grid";
}

const WELCOME_STEP: DialogueStep = {
  id: "welcome",
  ai: "Welcome to Raconteur. What would you like to do today?",
  options: ["Continue Reading", "Start a New Story"],
  type: "grid",
};

const HERO_STEP: DialogueStep = {
  id: "hero",
  ai: "Every story needs a hero.",
  options: ["🌤 Weather near me", "Create avatar"],
  type: "row",
};

const AVATAR_STEP: DialogueStep = {
  id: "avatar",
  ai: "Choose your avatar:",
  options: [
    "Sir Fluffington",
    "Captain Chuckle",
    "Count Quackula",
    "Baron Von Bop",
    "Professor Puddle",
    "Lord Wiggles",
    "Doctor Doofus",
    "Madam Mischief",
    "Cancel"
  ],
  type: "grid",
};

const FLOW_ID = "main";

export function useStoryEngine() {
  const [phase, setPhase] = useState<FlowPhase>("WELCOME");
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [flowSteps, setFlowSteps] = useState<DialogueStep[]>([]);
  const [ragContext, setRagContext] = useState<RagDocument[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Weather state injected into dialogue
  const [weatherMessage, setWeatherMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const result = await getDialogueFlow();
        if (result.exists && result.data.steps) {
          setFlowSteps(result.data.steps as DialogueStep[]);
        }
      } catch (err) {
        console.error("Failed to load flow steps", err);
      }
    };
    fetchFlow();
  }, []);

  const saveUserChoice = async (stepId: string, option: string) => {
    if (!auth.currentUser) return;
    try {
      await saveUserChoiceAction(auth.currentUser.uid, stepId, option);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const addRagContext = (content: string, metadata: any) => {
    const newDoc: RagDocument = {
      id: Date.now().toString(),
      content,
      metadata,
      score: 1.0,
    };
    setRagContext((prev) => [newDoc, ...prev]);
  };

  const handleSelection = async (option: string, onRequireAuth: () => void) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (phase === "WELCOME") {
        if (option === "Continue Reading") {
          onRequireAuth();
        } else if (option === "Start a New Story") {
          setPhase("HERO");
        }
      } else if (phase === "HERO") {
        if (option === "🌤 Weather near me") {
          // Weather logic to be triggered by component
        } else if (option === "Create avatar") {
          setPhase("AVATAR");
        }
      } else if (phase === "AVATAR") {
        if (option === "Cancel") {
          setPhase("HERO");
        } else {
          if (auth.currentUser) {
            await writeRagData(auth.currentUser.uid, "avatar_selection", { avatar: option });
          }
          addRagContext(`Selected Avatar: ${option}`, { source: "Avatar Creation", type: "Avatar Choice" });
          setPhase("STORY");
          setStoryStepIndex(0);
        }
      } else if (phase === "STORY") {
        const currentStep = flowSteps[storyStepIndex];
        if (currentStep) {
          // Optimistic UI could be added here, but we await the DB save for safety
          await saveUserChoice(currentStep.id, option);
          addRagContext(`[${currentStep.ai}] → ${option}`, {
            source: `dialogueFlows/${FLOW_ID}`,
            type: "Story Choice",
            stepId: currentStep.id,
          });

          if (storyStepIndex + 1 < flowSteps.length) {
            setStoryStepIndex((i) => i + 1);
          } else {
            // End of flow
            console.log("End of current flow steps.");
          }
        }
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic updates if implemented
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDialogue = (): DialogueStep => {
    if (phase === "WELCOME") return WELCOME_STEP;
    if (phase === "HERO") {
      return weatherMessage
        ? { ...HERO_STEP, ai: weatherMessage, options: ["🌤 Weather near me", "Create avatar"], type: "row" }
        : HERO_STEP;
    }
    if (phase === "AVATAR") return AVATAR_STEP;
    if (phase === "STORY") return flowSteps[storyStepIndex] || WELCOME_STEP;
    return WELCOME_STEP;
  };

  return {
    phase,
    dialogue: currentDialogue(),
    ragContext,
    isSubmitting,
    error,
    handleSelection,
    setWeatherMessage,
    flowSteps, // Exported for writer mode
    setFlowSteps, // Exported for writer mode
  };
}
