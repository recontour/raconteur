export interface StoryNode {
  id: string;
  content: string;
  chapter_number: number;
  page_number: number;
  parent_node_id: string | null;
  choice_label: string | null;
  choices?: StoryChoice[];
}

export interface StoryChoice {
  label: string;
  intent: string;
}

export interface UserProgress {
  user_id: string;
  current_node_id: string;
  path_history: string[]; // Array of Node IDs
  selected_genre: string;
  story_title?: string;
}
