import type { ConversationLevel } from "@/lib/supabase";

export type ConversationTurn =
  | {
      speaker: "ai";
      text: string;
      translation: string;
    }
  | {
      speaker: "user";
      expected: string;
      translation: string;
    };

export const CONVERSATION_LEVEL_OPTIONS: readonly ConversationLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const CONVERSATION_LEVEL_LABELS: Record<ConversationLevel, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};

export function getConversationLevelLabel(level: ConversationLevel): string {
  return CONVERSATION_LEVEL_LABELS[level];
}

export function parseConversationTurns(value: unknown): ConversationTurn[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const turns: ConversationTurn[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const source = item as Record<string, unknown>;

    if (
      source.speaker === "ai" &&
      typeof source.text === "string" &&
      typeof source.translation === "string"
    ) {
      turns.push({
        speaker: "ai",
        text: source.text,
        translation: source.translation,
      });
      continue;
    }

    if (
      source.speaker === "user" &&
      typeof source.expected === "string" &&
      typeof source.translation === "string"
    ) {
      turns.push({
        speaker: "user",
        expected: source.expected,
        translation: source.translation,
      });
      continue;
    }

    return null;
  }

  return turns.length > 0 ? turns : null;
}
