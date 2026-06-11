export interface DiaryOption {
  label: string;
  type: "navigate" | "redirect" | "login" | "back" | "coming_soon";
  nextScene?: string | null;
  href?: string;
}

export interface DiaryScene {
  id: string;
  heroMessage: string;
  options: DiaryOption[];
  updatedAt?: string;
  generatedBy?: "seed" | "admin" | "gemini";
}
