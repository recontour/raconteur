export enum Genre {
  DETECTIVE = "Mysteries",
  ROMANCE = "Romance",
  HISTORICAL = "Historical",
  ADVENTURE = "Adventure"
}

export enum ChoiceType {
  LOGICAL = "Logical",
  UNEXPECTED = "Unexpected"
}

export interface Choice {
  text: string;
  type: ChoiceType | string;
}

export interface StorySegment {
  storyTitle?: string;
  chapterTitle: string;
  storyText: string;
  choices: Choice[];
}

export interface HistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface AppState {
  genre: Genre | null;
  history: HistoryItem[];
  currentSegment: StorySegment | null;
  isLoading: boolean;
  isTyping: boolean;
  gameStarted: boolean;
}