import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Phrase = {
  id: string;
  scene: string;
  japanese: string;
  english: string;
  hint: string;
  level: PhraseLevel;
  pronunciation_difficulty: PronunciationDifficulty;
  grammar_tags: string[];
  created_at?: string;
};

export type PhraseLevel = "beginner" | "intermediate" | "advanced";
export type PronunciationDifficulty = "easy" | "normal" | "hard";

export type PracticeLog = {
  id: string;
  phrase_id: string | null;
  scene: string;
  japanese: string;
  correct_english: string;
  user_answer: string;
  score: number;
  is_correct: boolean;
  practiced_at: string;
  pronunciation_score: number | null;
  recognized_speech: string | null;
};

type InsertPracticeLog = Omit<PracticeLog, "id" | "pronunciation_score" | "recognized_speech"> & {
  pronunciation_score?: number | null;
  recognized_speech?: string | null;
};

export type Database = {
  public: {
    Tables: {
      english_phrases: {
        Row: Phrase;
        Insert: Omit<Phrase, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Phrase>;
        Relationships: [];
      };
      english_practice_logs: {
        Row: PracticeLog;
        Insert: InsertPracticeLog & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PracticeLog>;
        Relationships: [
          {
            foreignKeyName: "english_practice_logs_phrase_id_fkey";
            columns: ["phrase_id"];
            isOneToOne: false;
            referencedRelation: "english_phrases";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppSupabaseClient = SupabaseClient<Database>;

export function createSupabaseClient(): AppSupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabaseの環境変数が設定されていません。");
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
