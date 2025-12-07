"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import GenreSelector from "@/components/game/GenreSelector";
import GenreLoader from "@/components/ui/GenreLoader";
import ActiveStoryNode from "@/components/game/ActiveStoryNode";
import {
  Home,
  Trash2,
  Search,
  BookOpen,
  Ghost,
  Zap,
  Sparkles,
} from "lucide-react";
import { StoryNode } from "@/types";

// Helper for icons
const getGenreIcon = (genre: string | null) => {
  if (!genre) return BookOpen;
  const g = genre.toLowerCase();
  if (g.includes("sci") || g.includes("cyber")) return Zap;
  if (g.includes("horr")) return Ghost;
  if (g.includes("mys") || g.includes("noir")) return Search;
  if (g.includes("fantasy")) return Sparkles;
  return BookOpen;
};

// Helper for genre colors
const getGenreColor = (genre: string | null) => {
  if (!genre) return "text-blue-400";
  const g = genre.toLowerCase();
  if (g.includes("sci") || g.includes("cyber")) return "text-cyan-400";
  if (g.includes("horr")) return "text-emerald-400";
  if (g.includes("mys") || g.includes("noir")) return "text-amber-400";
  if (g.includes("fantasy")) return "text-purple-400";
  return "text-blue-400";
};

export default function BookPage() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [storyHistory, setStoryHistory] = useState<StoryNode[]>([]);
  const [viewState, setViewState] = useState<"genres" | "book" | "loading">(
    "loading"
  );
  const [currentGenre, setCurrentGenre] = useState<string | null>(null);
  const [typingNodeId, setTypingNodeId] = useState<string | null>(null);
  const [areChoicesReady, setAreChoicesReady] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const initBook = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/");
      setUserId(user.id);

      const { data: progress } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!progress) {
        setViewState("genres");
        setLoading(false);
      } else {
        setCurrentGenre(progress.selected_genre);
        setStoryTitle(progress.story_title);

        if (progress.path_history && progress.path_history.length > 0) {
          const { data: nodes } = await supabase
            .from("story_nodes")
            .select("*")
            .in("id", progress.path_history)
            .order("created_at", { ascending: true });

          if (nodes) {
            const sortedNodes = progress.path_history
              .map((id: string) => nodes.find((n) => n.id === id))
              .filter(Boolean) as StoryNode[];

            setStoryHistory(sortedNodes);
            setTypingNodeId(null);
            setAreChoicesReady(true);
            setViewState("genres");
          }
        }
        setLoading(false);
      }
    };

    initBook();
  }, [router]);

  // --- SCROLL HELPER ---
  const scrollToBottom = (instant = false) => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollHeight > clientHeight) {
        scrollContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: instant ? "auto" : "smooth",
        });
      }
    }
  };

  // --- ACTIONS ---
  const handleStartStory = async (genreId: string, prompt: string) => {
    setViewState("loading");
    setCurrentGenre(genreId);
    setAreChoicesReady(false);

    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          previousNodeId: null,
          choiceLabel: "The story begins...",
          genre: prompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newNode = data.node;

      if (data.title) setStoryTitle(data.title);

      setStoryHistory([newNode]);
      setTypingNodeId(newNode.id);

      await supabase.from("user_progress").upsert({
        user_id: userId,
        current_node_id: newNode.id,
        path_history: [newNode.id],
        selected_genre: genreId,
        story_title: data.title,
      });

      setViewState("book");
    } catch (err) {
      console.error(err);
      alert("Failed to start.");
      setViewState("genres");
    }
  };

  const handleContinueStory = () => {
    setTypingNodeId(null);
    setAreChoicesReady(true);
    setViewState("book");
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleChoice = async (choice: any) => {
    if (!userId) return;
    setIsLoadingNext(true);
    setAreChoicesReady(false);

    setTimeout(() => scrollToBottom(true), 50);

    const lastNode = storyHistory[storyHistory.length - 1];

    try {
      const { data: existingNode } = await supabase
        .from("story_nodes")
        .select("*")
        .eq("parent_node_id", lastNode.id)
        .eq("choice_label", choice.label)
        .maybeSingle();

      let newNode: StoryNode;

      if (existingNode) {
        newNode = existingNode;
      } else {
        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            previousNodeId: lastNode.id,
            choiceLabel: choice.label,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        newNode = data.node;
      }

      setStoryHistory((prev) => [...prev, newNode]);
      setTypingNodeId(newNode.id);

      const { data: currentProgress } = await supabase
        .from("user_progress")
        .select("path_history")
        .eq("user_id", userId)
        .single();
      const updatedPath = [
        ...(currentProgress?.path_history || []),
        newNode.id,
      ];
      await supabase
        .from("user_progress")
        .update({ current_node_id: newNode.id, path_history: updatedPath })
        .eq("user_id", userId);

      setIsLoadingNext(false);
    } catch (err) {
      console.error(err);
      setIsLoadingNext(false);
      setAreChoicesReady(true);
    }
  };

  // --- RENDER ---
  const GenreIcon = getGenreIcon(currentGenre);
  const genreColor = getGenreColor(currentGenre);
  const lastNode = storyHistory[storyHistory.length - 1];

  if (loading || viewState === "loading") {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-white flex flex-col items-center justify-center">
        <GenreLoader genreId={currentGenre} />
      </div>
    );
  }

  if (viewState === "genres") {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-white overflow-y-auto">
        <GenreSelector
          onSelect={handleStartStory}
          onContinue={handleContinueStory}
          hasExistingStory={storyHistory.length > 0}
          loading={loading}
        />
      </div>
    );
  }

  // --- BOOK VIEW ---
  return (
    <div className="fixed inset-0 bg-neutral-950 text-white font-sans flex flex-col overflow-hidden">
      {/* 1. ENHANCED HEADER */}
      <div className="flex-none h-18 w-full flex justify-between items-center px-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-50">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setViewState("genres")}
        >
          <div className="relative">
            <div
              className={`absolute inset-0 ${genreColor} opacity-20 blur-lg group-hover:opacity-40 transition-opacity`}
            />
            <Home
              size={18}
              className={`${genreColor} relative z-10 group-hover:scale-110 transition-transform`}
            />
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-xs font-bold text-white tracking-tight leading-tight line-clamp-1 uppercase max-w-[200px] group-hover:text-neutral-200 transition-colors">
              {storyTitle || currentGenre || "Unknown"}
            </h1>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest group-hover:text-neutral-400 transition-colors">
              CHAPTER {lastNode?.chapter_number || 1}
            </span>
          </div>
        </div>
        <button
          onClick={async () => {
            if (confirm("Delete story?")) {
              await supabase
                .from("user_progress")
                .delete()
                .eq("user_id", userId);
              window.location.reload();
            }
          }}
          className="text-neutral-600 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* 2. SCROLL AREA */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto w-full relative pt-4 px-6 scrollbar-hide"
      >
        {storyHistory.map((node, index) => {
          const isTypingThisNode = node.id === typingNodeId;

          if (isTypingThisNode) {
            return (
              <div key={node.id}>
                <ActiveStoryNode
                  node={node}
                  speed={25}
                  onType={() => scrollToBottom(true)}
                  onComplete={() => {
                    setTypingNodeId(null);
                    setAreChoicesReady(true);
                    scrollToBottom(true);
                  }}
                />
              </div>
            );
          } else {
            return (
              <div key={node.id} className="animate-in fade-in duration-500">
                <p className="text-base pt-2 md:text-lg leading-relaxed text-neutral-300 whitespace-pre-line font-sans">
                  {node.content}
                </p>
                <div className="mt-2 text-right border-b border-white/5 pb-1">
                  <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">
                    Page {node.page_number}
                  </span>
                </div>
              </div>
            );
          }
        })}
        <div className="h-1 flex-none" />
      </div>

      {/* 3. ENHANCED FOOTER */}
      <div className="flex-none h-[130px] w-full bg-neutral-950 border-t border-white/5 relative z-50">
        {isLoadingNext && (
          <div className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in duration-500 gap-2">
            <div className="relative">
              <div
                className={`absolute inset-0 ${genreColor} opacity-20 blur-xl animate-pulse`}
              />
              <GenreIcon
                size={20}
                className={`${genreColor} animate-bounce relative z-10`}
              />
            </div>
            <p className="text-neutral-500 text-[10px] tracking-widest uppercase">
              Writing next page...
            </p>
          </div>
        )}

        {typingNodeId && (
          <div className="absolute inset-0 flex items-center justify-center animate-in fade-in">
            <span className="text-neutral-700 text-[10px] tracking-[0.3em] animate-pulse">
              WRITING...
            </span>
          </div>
        )}

        <div
          className={`
              transition-opacity duration-[800ms] ease-out w-full h-full p-4 flex flex-col justify-center gap-2
              ${
                areChoicesReady && !isLoadingNext && !typingNodeId
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }
          `}
        >
          {lastNode?.choices?.map((choice: any, i: number) => (
            <button
              key={i}
              onClick={() => handleChoice(choice)}
              className="relative w-full py-2.5 px-3 bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 hover:border-white/20 text-center rounded-lg transition-all active:scale-95 shadow-lg flex items-center justify-center group overflow-hidden"
            >
              {/* Subtle hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <span className="text-neutral-200 group-hover:text-white text-xs font-medium leading-snug relative z-10 transition-colors">
                {choice.label}
              </span>

              {/* Arrow indicator */}
              <div className="absolute right-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 transition-all duration-300">
                <svg
                  className="w-3 h-3 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
