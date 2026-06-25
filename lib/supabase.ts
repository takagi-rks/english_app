import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Phrase = {
  id: string;
  scene: string;
  japanese: string;
  english: string;
  hint: string;
  level: PhraseLevel;
  created_at?: string;
};

export type PhraseLevel = "beginner" | "intermediate" | "advanced";

export type PracticeLog = {
  id: string;
  phrase_id: string | null;
  scene: string;
  japanese: string;
  correct_english: string;
  user_answer: string;
  score: number;
  is_correct: boolean;
};

type InsertPracticeLog = Omit<PracticeLog, "id">;

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
