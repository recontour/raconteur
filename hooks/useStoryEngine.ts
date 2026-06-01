import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { getDialogueFlow, saveUserChoiceAction, moveStoryJsonToDb, getOrInitStory, StoryParagraph } from "@/app/actions/user";
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


const FLOW_ID = "main";

export function useStoryEngine() {
  const [phase, setPhase] = useState<FlowPhase>("WELCOME");
  const [storyStepIndex, setStoryStepIndex] = useState(0);
  const [flowSteps, setFlowSteps] = useState<DialogueStep[]>([]);
  const [ragContext, setRagContext] = useState<RagDocument[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ device: string; browser: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Book/Story content state
  const [storyParagraphs, setStoryParagraphs] = useState<StoryParagraph[]>([]);
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Load session info into RAG context on mount
  useEffect(() => {
    const stored = localStorage.getItem("raconteur_session_info");
    if (stored) {
      const info = JSON.parse(stored);
      setSessionInfo(info);
      addRagContext(`User Environment: ${info.browser} on ${info.device}`, { source: "SessionTracker", type: "System Info" });
    }
  }, []);

  // Handle audio playback and sync for book paragraphs
  useEffect(() => {
    if (phase === "STORY" && storyParagraphs.length > 0) {
      const p = storyParagraphs[storyStepIndex];
      if (p?.audio) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }

        const audio = new Audio(p.audio);
        audioRef.current = audio;

        const update = () => {
          setAudioProgress({ current: audio.currentTime, duration: audio.duration || 0 });
        };

        audio.addEventListener("timeupdate", update);
        audio.addEventListener("loadedmetadata", update);
        audio.play().catch((err) => console.warn("Audio play blocked by browser:", err));

        return () => {
          audio.removeEventListener("timeupdate", update);
          audio.removeEventListener("loadedmetadata", update);
          audio.pause();
        };
      }
    }
  }, [phase, storyStepIndex, storyParagraphs]);

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
          const savedId = localStorage.getItem('active_story_id');
          if (savedId) {
            const { paragraphs } = await getOrInitStory(savedId);
            setStoryParagraphs(paragraphs);
            setPhase("STORY");
            return;
          }
          onRequireAuth();
        } else if (option === "Start a New Story") {
          const storyUid = "omelas-v1";
          await moveStoryJsonToDb(storyUid);
          localStorage.setItem('active_story_id', storyUid);
          const { paragraphs } = await getOrInitStory(storyUid);
          setStoryParagraphs(paragraphs);
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
        // If we are in the book flow, advance through paragraphs
        if (storyParagraphs.length > 0) {
          if (storyStepIndex + 1 < storyParagraphs.length) {
            setStoryStepIndex((i) => i + 1);
            return;
          }
        }
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
    
    if (phase === "STORY") {
      if (storyParagraphs.length > 0) {
        const p = storyParagraphs[storyStepIndex];
        return {
          id: p.slug,
          ai: p.text,
          options: p.options || ["Continue", "Reflect"],
          type: "grid"
        };
      }
      return flowSteps[storyStepIndex] || WELCOME_STEP;
    }
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
    sessionInfo,
    setFlowSteps, // Exported for writer mode
    audioProgress, // Sync state for minimalist Apple-style UI animation
  };
}
