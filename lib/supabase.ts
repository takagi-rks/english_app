import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

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
export type ToeicPart = "part1" | "part2" | "part3" | "part4" | "part5" | "part6" | "part7";
export type ToeicDifficulty = "beginner" | "intermediate" | "advanced";
export type ToeicChoiceKey = "A" | "B" | "C" | "D";
export type ToeicChoices = Record<ToeicChoiceKey, string>;

export type ToeicQuestion = {
  id: string;
  part: ToeicPart;
  question_text: string;
  choices: Json;
  correct_choice: ToeicChoiceKey;
  explanation: string | null;
  difficulty: ToeicDifficulty;
  tags: string[];
  created_at?: string;
};

export type ToeicPracticeLog = {
  id: string;
  question_id: string | null;
  selected_choice: ToeicChoiceKey;
  correct_choice: ToeicChoiceKey;
  is_correct: boolean;
  practiced_at: string;
};

export type ConversationLevel = "beginner" | "intermediate" | "advanced";

export type ConversationScenario = {
  id: string;
  scene: string;
  title: string;
  description: string | null;
  level: ConversationLevel;
  turns: Json;
  created_at?: string;
};

export type ConversationLog = {
  id: string;
  scenario_id: string | null;
  score: number;
  is_completed: boolean;
  practiced_at: string;
};

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

type InsertToeicQuestion = Omit<ToeicQuestion, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

type InsertToeicPracticeLog = Omit<ToeicPracticeLog, "id"> & {
  id?: string;
};

type InsertConversationScenario = Omit<ConversationScenario, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

type InsertConversationLog = Omit<ConversationLog, "id"> & {
  id?: string;
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
      toeic_questions: {
        Row: ToeicQuestion;
        Insert: InsertToeicQuestion;
        Update: Partial<ToeicQuestion>;
        Relationships: [];
      };
      toeic_practice_logs: {
        Row: ToeicPracticeLog;
        Insert: InsertToeicPracticeLog;
        Update: Partial<ToeicPracticeLog>;
        Relationships: [
          {
            foreignKeyName: "toeic_practice_logs_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "toeic_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_scenarios: {
        Row: ConversationScenario;
        Insert: InsertConversationScenario;
        Update: Partial<ConversationScenario>;
        Relationships: [];
      };
      conversation_logs: {
        Row: ConversationLog;
        Insert: InsertConversationLog;
        Update: Partial<ConversationLog>;
        Relationships: [
          {
            foreignKeyName: "conversation_logs_scenario_id_fkey";
            columns: ["scenario_id"];
            isOneToOne: false;
            referencedRelation: "conversation_scenarios";
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
