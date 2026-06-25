import type { PhraseLevel, PronunciationDifficulty } from "@/lib/supabase";

export const SCENE_OPTIONS = [
  "greeting",
  "self_introduction",
  "cafe",
  "restaurant",
  "shopping",
  "hotel",
  "airport",
  "directions",
  "smalltalk",
] as const;

export type SceneOption = (typeof SCENE_OPTIONS)[number];

export const SCENE_LABELS: Record<SceneOption, string> = {
  greeting: "あいさつ",
  self_introduction: "自己紹介",
  cafe: "カフェ",
  restaurant: "レストラン",
  shopping: "買い物",
  hotel: "ホテル",
  airport: "空港",
  directions: "道案内",
  smalltalk: "雑談",
};

export const LEVEL_OPTIONS: readonly PhraseLevel[] = ["beginner", "intermediate", "advanced"];

export const LEVEL_LABELS: Record<PhraseLevel, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};

export const PRONUNCIATION_DIFFICULTY_OPTIONS: readonly PronunciationDifficulty[] = [
  "easy",
  "normal",
  "hard",
];

export const PRONUNCIATION_DIFFICULTY_LABELS: Record<PronunciationDifficulty, string> = {
  easy: "★☆☆ 易しい",
  normal: "★★☆ 普通",
  hard: "★★★ 難しい",
};

export function getSceneLabel(scene: string): string {
  return SCENE_OPTIONS.includes(scene as SceneOption) ? SCENE_LABELS[scene as SceneOption] : scene;
}

export function getLevelLabel(level: PhraseLevel): string {
  return LEVEL_LABELS[level];
}

export function getPronunciationDifficultyLabel(difficulty: PronunciationDifficulty): string {
  return PRONUNCIATION_DIFFICULTY_LABELS[difficulty];
}
