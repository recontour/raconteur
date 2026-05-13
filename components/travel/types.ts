export type LocationState = "idle" | "loading" | "done" | "denied" | "error";

export interface ChatOption {
  label: string;
  searchQuery: string;
}

export interface SerpEvent {
  title: string;
  date?: { when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name: string; rating?: number };
}

export interface ActivityData {
  id: string;
  title: string;
  description: string;
  place: {
    name: string;
    address: string;
    rating?: number;
    reviews?: number;
  };
  category: string;
  date: {
    when: string;
    nextEvent?: string;
  };
  thumbnail?: string;
  link?: string;
  context: {
    summary: string;
    whyRelevant: string;
    typical_duration: string;
  };
}

export type ChatMessage =
  | { id: string; type: "bot"; content: string }
  | { id: string; type: "options"; options: ChatOption[]; picked?: string }
  | { id: string; type: "option-reply"; content: string; events: SerpEvent[] };

export const ACTIVITIES = [
  { id: "adventure", label: "Adventure",    sub: "Go beyond the map"          },
  { id: "romance",   label: "Romance",       sub: "Moments worth remembering"  },
  { id: "whats-on",  label: "What's On",     sub: "Live now, near you"         },
  { id: "food",      label: "Food & Drink",  sub: "Taste the local story"      },
  { id: "culture",   label: "Culture",       sub: "Art, history, wonder"       },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];
