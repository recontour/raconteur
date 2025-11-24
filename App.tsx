import React, { useState, useEffect, useRef } from "react";
import {
  Fingerprint,
  Heart,
  Landmark,
  Compass,
  Smartphone,
  Loader2,
  BookOpen,
} from "lucide-react";

// --- TYPES ---

export enum Genre {
  DETECTIVE = "Detective",
  ROMANCE = "Romance",
  HISTORICAL = "Historical",
  ADVENTURE = "Adventure",
}

export interface Choice {
  text: string;
}

export interface StorySegment {
  storyTitle?: string;
  chapterTitle?: string;
  storyText: string;
  choices: Choice[];
}

export interface HistoryItem {
  role: "user" | "model";
  text: string;
}

// --- CONFIGURATION ---

const API_KEY = ""; // ⚠️ PASTE YOUR GEMINI API KEY HERE

const SYSTEM_INSTRUCTION = `
You are an interactive storyteller. 
- Write in an adventurous, 'Old Times' vintage style.
- Keep scenes under 700 characters.
- Use a slow, immersive pace.
- Always return a JSON object with:
  {
    "storyTitle": "string (only for first segment)",
    "chapterTitle": "string",
    "storyText": "string",
    "choices": [{ "text": "Logical Choice" }, { "text": "Unexpected Choice" }]
  }
`;

// --- SERVICES (Inlined) ---

const callGemini = async (prompt: string, history: HistoryItem[] = []) => {
  if (!API_KEY) {
    // Return mock data if no key is present for preview purposes
    console.warn("No API Key provided. Using mock response.");
    return {
      storyTitle: "The Mocked Tale",
      chapterTitle: "Chapter 1: The Missing Key",
      storyText:
        "You find yourself staring at a screen. It seems the API key is missing from the code. The storyteller waits silently for the magic words that will breathe life into this world.",
      choices: [{ text: "Add the API Key" }, { text: "Continue in silence" }],
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            ...history.map((h) => ({
              role: h.role,
              parts: [{ text: h.text }],
            })),
            { role: "user", parts: [{ text: prompt }] },
          ],
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const startNewStory = async (genre: Genre): Promise<StorySegment> => {
  return callGemini(`Start a new ${genre} story.`);
};

export const continueStory = async (
  genre: Genre,
  history: HistoryItem[],
  choice: string
): Promise<StorySegment> => {
  return callGemini(`User chose: ${choice}. Continue the story.`, history);
};

// --- COMPONENTS ---

const Typewriter: React.FC<{
  text: string;
  onComplete: () => void;
  speed?: number;
}> = ({ text, onComplete, speed = 30 }) => {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(indexRef.current));
      indexRef.current++;
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        onComplete();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return <span>{displayedText}</span>;
};

const LoadingSpinner: React.FC<{ genre: Genre | null }> = ({ genre }) => {
  return (
    <div className="flex flex-col items-center justify-center text-blue-400">
      <Loader2 className="w-12 h-12 animate-spin mb-4" />
      <BookOpen className="w-6 h-6 absolute animate-pulse text-blue-600" />
    </div>
  );
};

// --- MAIN APP ---

const LOADING_MESSAGES: Record<string, string[]> = {
  [Genre.DETECTIVE]: [
    "Connecting the clues...",
    "The shadows are shifting...",
    "Deducing the truth...",
    "The suspect is hesitating...",
  ],
  [Genre.ROMANCE]: [
    "A heart skips a beat...",
    "Catching a stolen glance...",
    "Sealing the letter...",
    "Tension fills the air...",
  ],
  [Genre.HISTORICAL]: [
    "Dipping quill in ink...",
    "Turning the dusty page...",
    "The ink is drying...",
    "Consulting the archives...",
  ],
  [Genre.ADVENTURE]: [
    "Charting the path ahead...",
    "Unfolding the map...",
    "Destiny is calling...",
    "The horizon is expanding...",
  ],
};

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(true);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const [story, setStory] = useState<StorySegment | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [story, loading]);

  useEffect(() => {
    let interval: number;
    if (loading && genre) {
      const messages =
        LOADING_MESSAGES[genre] || LOADING_MESSAGES[Genre.ADVENTURE];
      const pickRandom = () =>
        messages[Math.floor(Math.random() * messages.length)];
      setLoadingText(pickRandom());
      interval = window.setInterval(() => setLoadingText(pickRandom()), 2000);
    }
    return () => clearInterval(interval);
  }, [loading, genre]);

  const handleGenreSelect = async (selectedGenre: Genre) => {
    setGenre(selectedGenre);
    setLoading(true);
    setError(null);
    try {
      const initialStory = await startNewStory(selectedGenre);
      setStory(initialStory);
      setStoryTitle(initialStory.storyTitle || selectedGenre);
      setHistory([{ role: "model", text: initialStory.storyText }]);
      setIsTyping(true);
    } catch (err) {
      setError("Unable to start the story. Please check API Key.");
      console.error(err);
      setGenre(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (choiceText: string) => {
    if (!genre || !story) return;
    setLoading(true);
    setIsTyping(true);
    setError(null);

    const updatedHistory: HistoryItem[] = [
      ...history,
      { role: "user", text: choiceText },
    ];
    setHistory(updatedHistory);

    try {
      const nextSegment = await continueStory(
        genre,
        updatedHistory,
        choiceText
      );
      setStory(nextSegment);
      setHistory((prev) => [
        ...prev,
        { role: "model", text: nextSegment.storyText },
      ]);
    } catch (err) {
      setError("Connection lost. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetStory = () => {
    setGenre(null);
    setStoryTitle(null);
    setStory(null);
    setHistory([]);
    setError(null);
  };

  if (!isMobile) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-screen bg-blue-50 text-slate-900 p-8 font-sans">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-12 border border-blue-100">
          <Smartphone className="w-16 h-16 mx-auto mb-6 text-blue-500" />
          <h1 className="text-2xl font-bold mb-4 text-blue-900">
            Mobile Experience Only
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Please open this on your phone.
          </p>
        </div>
      </div>
    );
  }

  // Genre Selection - MODIFIED: 2-Column Grid
  if (!story && !loading && !genre) {
    return (
      <div className="h-[100dvh] w-full flex flex-col bg-blue-50 relative overflow-hidden font-sans fixed inset-0">
        <header className="z-10 pt-12 pb-4 px-6 text-center bg-white shadow-sm border-b border-blue-100">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight mb-2">
            Hi, I am Raconteur.
          </h1>
          <p className="text-sm font-medium text-slate-500 tracking-wide">
            Here to tell you a story. What would intrigue you?
          </p>
        </header>

        <div className="z-10 flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
          <button
            onClick={() => handleGenreSelect(Genre.DETECTIVE)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300 flex flex-col justify-between h-full min-h-[140px]"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <span className="font-bold text-sm text-slate-900">
                {Genre.DETECTIVE}
              </span>
              <Fingerprint className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-xs text-slate-600 leading-snug">
              Rain-slicked streets, smokey offices, and a case that doesn't add
              up.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.ADVENTURE)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300 flex flex-col justify-between h-full min-h-[140px]"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <span className="font-bold text-sm text-slate-900">
                {Genre.ADVENTURE}
              </span>
              <Compass className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-xs text-slate-600 leading-snug">
              Lost temples, treacherous jungles, and the hunt for glory.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.ROMANCE)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300 flex flex-col justify-between h-full min-h-[140px]"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <span className="font-bold text-sm text-slate-900">
                {Genre.ROMANCE}
              </span>
              <Heart className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-xs text-slate-600 leading-snug">
              Stolen glances, grand ballrooms, and scandals whispered behind
              fans.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.HISTORICAL)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300 flex flex-col justify-between h-full min-h-[140px]"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <span className="font-bold text-sm text-slate-900">
                {Genre.HISTORICAL}
              </span>
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-xs text-slate-600 leading-snug">
              Witness the turning tides of history through the eyes of the
              forgotten.
            </p>
          </button>

          {error && (
            <div className="col-span-2 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center mt-2">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Initial Loading
  if (loading && !story) {
    return (
      <div className="h-[100dvh] w-full bg-blue-50 flex flex-col items-center justify-center font-sans fixed inset-0">
        <LoadingSpinner genre={genre} />
        <p className="mt-6 text-blue-500 font-medium italic animate-pulse text-lg">
          {loadingText}
        </p>
      </div>
    );
  }

  // Story Screen
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-blue-50 relative overflow-hidden font-sans fixed inset-0">
      <div className="z-10 flex-none px-6 py-2 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-sm">
        <div className="flex flex-col items-center relative py-2">
          <button
            onClick={resetStory}
            className="absolute right-0 top-2 text-xs font-semibold text-blue-400 uppercase tracking-wider hover:text-blue-600"
          >
            Quit
          </button>
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight leading-tight mb-1">
            {storyTitle || genre}
          </h1>
          <h2 className="text-sm font-normal text-slate-400 uppercase tracking-widest">
            {story?.chapterTitle || "Loading..."}
          </h2>
        </div>
      </div>

      <div className="z-0 flex-1 overflow-y-auto px-6 py-6 pb-40 scroll-smooth">
        {loading ? (
          <div className="mt-12 flex flex-col items-center justify-center space-y-6">
            <LoadingSpinner genre={genre} />
            <p className="text-xl italic text-blue-400 font-medium animate-pulse text-center leading-relaxed">
              {loadingText}
            </p>
          </div>
        ) : story ? (
          <div className="max-w-prose mx-auto">
            <Typewriter
              text={story.storyText}
              onComplete={() => setIsTyping(false)}
              speed={50}
            />
          </div>
        ) : null}
        <div ref={contentEndRef} />
      </div>

      {!loading && (
        <div className="z-20 absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-blue-50 via-blue-50/95 to-transparent pt-12">
          <div
            className={`space-y-3 transition-opacity duration-[2000ms] ease-out ${
              isTyping
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            }`}
          >
            {story?.choices?.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleChoice(choice.text)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-xl text-sm md:text-base leading-snug shadow-lg shadow-blue-200 active:scale-[0.98] transition-all transform"
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
