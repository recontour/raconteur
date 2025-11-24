import React, { useState, useEffect, useRef } from "react";
import {
  Fingerprint,
  Heart,
  Landmark,
  Compass,
  Smartphone,
} from "lucide-react";
import { Genre, StorySegment, HistoryItem } from "./types";
import { startNewStory, continueStory } from "./services/geminiService";
import { Typewriter } from "./components/Typewriter";
import { LoadingSpinner } from "./components/LoadingSpinner";

const API_KEY = import.meta.env.VITE_GEMINI_KEY;

// Loading messages configuration
const LOADING_MESSAGES: Record<string, string[]> = {
  [Genre.DETECTIVE]: [
    "Connecting the clues...",
    "The shadows are shifting...",
    "Deducing the truth...",
    "The suspect is hesitating...",
    "Lighting a cigarette...",
    "Checking the files...",
  ],
  [Genre.ROMANCE]: [
    "A heart skips a beat...",
    "Catching a stolen glance...",
    "Sealing the letter...",
    "Tension fills the air...",
    "A gentle touch...",
    "Whispering secrets...",
  ],
  [Genre.HISTORICAL]: [
    "Dipping quill in ink...",
    "Turning the dusty page...",
    "The ink is drying...",
    "Consulting the archives...",
    "History is being written...",
    "The candle flickers...",
  ],
  [Genre.ADVENTURE]: [
    "Charting the path ahead...",
    "Unfolding the map...",
    "Destiny is calling...",
    "The horizon is expanding...",
    "Checking the compass...",
    "Sharpening the blade...",
  ],
};

const App: React.FC = () => {
  // --- State Initialization with LocalStorage ---
  const getSavedState = () => {
    try {
      const saved = localStorage.getItem("raconteur_state");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse saved state", e);
      return null;
    }
  };

  const savedState = getSavedState();

  const [isMobile, setIsMobile] = useState(true);
  const [genre, setGenre] = useState<Genre | null>(savedState?.genre || null);
  const [storyTitle, setStoryTitle] = useState<string | null>(
    savedState?.storyTitle || null
  );
  const [story, setStory] = useState<StorySegment | null>(
    savedState?.story || null
  );
  const [history, setHistory] = useState<HistoryItem[]>(
    savedState?.history || []
  );
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  // If restoring a story, start in typing mode to ensure UI consistency
  const [isTyping, setIsTyping] = useState(!!savedState?.story);
  const [error, setError] = useState<string | null>(null);

  const contentEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Save state to LocalStorage
  useEffect(() => {
    if (genre && story && !loading) {
      localStorage.setItem(
        "raconteur_state",
        JSON.stringify({
          genre,
          storyTitle,
          story,
          history,
        })
      );
    }
  }, [genre, storyTitle, story, history, loading]);

  // Mobile Guard Check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Scroll to bottom when content changes
  useEffect(() => {
    if (contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [story, loading]);

  // Dynamic Loading Text Logic
  useEffect(() => {
    let interval: number;

    if (loading && genre) {
      const messages =
        LOADING_MESSAGES[genre] || LOADING_MESSAGES[Genre.ADVENTURE];

      const pickRandom = () =>
        messages[Math.floor(Math.random() * messages.length)];

      // Set initial message
      setLoadingText(pickRandom());

      // Cycle message every 2 seconds
      interval = window.setInterval(() => {
        setLoadingText(pickRandom());
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [loading, genre]);

  // --- Handlers ---

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
      setError("Unable to start the story. Please try again.");
      console.error(err);
      setGenre(null); // Go back
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (choiceText: string) => {
    if (!genre || !story) return;

    // 1. Update UI immediately to show loading
    setLoading(true);
    setIsTyping(true); // Reset typing for next segment
    setError(null);

    // 2. Add user choice to history
    const updatedHistory = [
      ...history,
      { role: "user", text: choiceText } as HistoryItem,
    ];
    setHistory(updatedHistory);

    try {
      // 3. Fetch next segment
      const nextSegment = await continueStory(
        genre,
        updatedHistory,
        choiceText
      );

      // 4. Update Story State
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

  const handleTypingComplete = () => {
    setIsTyping(false);
  };

  const resetStory = () => {
    localStorage.removeItem("raconteur_state");
    setGenre(null);
    setStoryTitle(null);
    setStory(null);
    setHistory([]);
    setError(null);
  };

  // --- Render Helpers ---

  if (!isMobile) {
    return (
      // FIX: Viewport Lock
      <div className="fixed inset-0 h-[100dvh] w-screen flex items-center justify-center bg-blue-50 text-slate-900 p-8 font-sans overflow-hidden overscroll-none">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-12 border border-blue-100">
          <Smartphone className="w-16 h-16 mx-auto mb-6 text-blue-500" />
          <h1 className="text-2xl font-bold mb-4 text-blue-900">
            Mobile Experience Only
          </h1>
          <p className="text-slate-600 leading-relaxed">
            This experience is designed specifically for mobile devices. Please
            open this on your phone.
          </p>
        </div>
      </div>
    );
  }

  // Genre Selection Screen
  if (!story && !loading && !genre) {
    return (
      // FIX: Viewport Lock
      <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-blue-50 relative overflow-hidden font-sans overscroll-none">
        {/* Header */}
        <header className="z-10 pt-12 pb-6 px-6 text-center bg-white shadow-sm border-b border-blue-100">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight mb-2">
            Hi, I am Raconteur.
          </h1>
          <p className="text-sm font-medium text-slate-500 tracking-wide">
            Here to tell you a story. What would intrigue you?
          </p>
        </header>

        {/* Grid - FIX: Reduced Padding (p-4) & Gap (gap-3) */}
        <div className="z-10 flex-1 overflow-y-auto p-4 grid grid-cols-1 gap-3">
          <button
            onClick={() => handleGenreSelect(Genre.DETECTIVE)}
            // FIX: Reduced Padding (p-4)
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300"
          >
            {/* FIX: Reduced Margin (mb-1) */}
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg text-slate-900">
                {Genre.DETECTIVE}
              </span>
              {/* FIX: Reduced Icon (w-5) */}
              <Fingerprint className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-sm text-slate-600 leading-tight">
              Rain-slicked streets, smokey offices, and a case that doesn't add
              up.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.ADVENTURE)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg text-slate-900">
                {Genre.ADVENTURE}
              </span>
              <Compass className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-sm text-slate-600 leading-tight">
              Lost temples, treacherous jungles, and the hunt for glory.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.ROMANCE)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg text-slate-900">
                {Genre.ROMANCE}
              </span>
              <Heart className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-sm text-slate-600 leading-tight">
              Stolen glances, grand ballrooms, and scandals whispered behind
              fans.
            </p>
          </button>

          <button
            onClick={() => handleGenreSelect(Genre.HISTORICAL)}
            className="group relative p-4 bg-white rounded-xl border border-blue-100 shadow-sm active:scale-[0.98] transition-all hover:shadow-md hover:border-blue-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg text-slate-900">
                {Genre.HISTORICAL}
              </span>
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-left text-sm text-slate-600 leading-tight">
              Witness the turning tides of history through the eyes of the
              forgotten.
            </p>
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center mt-4">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Initial Loading Screen (Between Genres)
  if (loading && !story) {
    return (
      // FIX: Viewport Lock
      <div className="fixed inset-0 h-[100dvh] w-full bg-blue-50 flex flex-col items-center justify-center font-sans overscroll-none">
        <LoadingSpinner genre={genre} />
        <p className="mt-6 text-blue-500 font-medium italic animate-pulse text-lg">
          {loadingText}
        </p>
      </div>
    );
  }

  // Story Screen
  return (
    // FIX: Viewport Lock
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-blue-50 relative overflow-hidden font-sans overscroll-none">
      {/* Top: Fixed Titles */}
      <div className="z-10 flex-none px-6 py-2 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-sm">
        <div className="flex flex-col items-center relative py-2">
          <button
            onClick={resetStory}
            className="absolute right-0 top-0 text-[10px] font-semibold text-blue-400 uppercase tracking-wider hover:text-blue-600"
          >
            Quit
          </button>

          {/* Story Name - FIX: Matched to Welcome Page Style (text-3xl font-bold text-blue-600) */}
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight leading-tight mb-1">
            {storyTitle || genre}
          </h1>

          {/* Chapter Title Below - Subtle */}
          <h2 className="text-sm font-normal text-slate-400 uppercase tracking-widest">
            {story?.chapterTitle || "Loading..."}
          </h2>
        </div>
      </div>

      {/* Middle: Scrollable Story Text */}
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
              onComplete={handleTypingComplete}
              speed={50}
            />
          </div>
        ) : null}
        <div ref={contentEndRef} />
      </div>

      {/* Bottom: Fixed Choices */}
      {!loading && (
        <div className="z-20 absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-blue-50 via-blue-50/95 to-transparent pt-12">
          {/* Increased duration for slower appearance (2000ms), added ease-out */}
          <div
            className={`space-y-3 transition-opacity duration-[2000ms] ease-out ${
              isTyping
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            }`}
          >
            {/* Render Choices - Square with rounded edges */}
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
