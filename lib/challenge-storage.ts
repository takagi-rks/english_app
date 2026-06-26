import type { ToeicChoiceKey, ToeicDifficulty, ToeicPart } from "@/lib/supabase";

const PHRASE_CHALLENGE_KEY = "english-trainer:phrase-challenge-draft";
const TOEIC_CHALLENGE_KEY = "english-trainer:toeic-challenge-draft";

type BaseDraft = {
  version: 1;
  savedAt: string;
};

export type StoredPhraseChallengeResult = {
  phraseId: string;
  japanese: string;
  correctEnglish: string;
  userAnswer: string;
  score: number;
  isCorrect: boolean;
};

export type PhraseChallengeDraft = BaseDraft & {
  mode: "phrase";
  selectedScene: string;
  phraseIds: string[];
  currentIndex: number;
  answer: string;
  currentResult: StoredPhraseChallengeResult | null;
  results: StoredPhraseChallengeResult[];
  showResults: boolean;
};

export type StoredToeicChallengeAnswer = {
  questionId: string;
  selectedChoice: ToeicChoiceKey;
  correctChoice: ToeicChoiceKey;
  isCorrect: boolean;
};

export type ToeicChallengeDraft = BaseDraft & {
  mode: "toeic";
  selectedPart: ToeicPart | "all";
  selectedDifficulty: ToeicDifficulty | "all";
  questionIds: string[];
  currentIndex: number;
  currentAnswer: StoredToeicChallengeAnswer | null;
  answers: StoredToeicChallengeAnswer[];
  showResults: boolean;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readJson(key: string): unknown {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("Failed to read challenge draft.", error);
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to save challenge draft.", error);
  }
}

function removeItem(key: string): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear challenge draft.", error);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPhraseResult(value: unknown): value is StoredPhraseChallengeResult {
  return (
    isObject(value) &&
    typeof value.phraseId === "string" &&
    typeof value.japanese === "string" &&
    typeof value.correctEnglish === "string" &&
    typeof value.userAnswer === "string" &&
    typeof value.score === "number" &&
    typeof value.isCorrect === "boolean"
  );
}

function isToeicChoice(value: unknown): value is ToeicChoiceKey {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function isToeicAnswer(value: unknown): value is StoredToeicChallengeAnswer {
  return (
    isObject(value) &&
    typeof value.questionId === "string" &&
    isToeicChoice(value.selectedChoice) &&
    isToeicChoice(value.correctChoice) &&
    typeof value.isCorrect === "boolean"
  );
}

export function savePhraseChallengeDraft(
  draft: Omit<PhraseChallengeDraft, "version" | "mode" | "savedAt">,
): void {
  writeJson(PHRASE_CHALLENGE_KEY, {
    ...draft,
    version: 1,
    mode: "phrase",
    savedAt: new Date().toISOString(),
  } satisfies PhraseChallengeDraft);
}

export function loadPhraseChallengeDraft(): PhraseChallengeDraft | null {
  const value = readJson(PHRASE_CHALLENGE_KEY);

  if (!isObject(value)) {
    return null;
  }

  if (
    value.version !== 1 ||
    value.mode !== "phrase" ||
    typeof value.savedAt !== "string" ||
    typeof value.selectedScene !== "string" ||
    !isStringArray(value.phraseIds) ||
    typeof value.currentIndex !== "number" ||
    typeof value.answer !== "string" ||
    typeof value.showResults !== "boolean" ||
    !Array.isArray(value.results) ||
    !value.results.every(isPhraseResult) ||
    !(value.currentResult === null || isPhraseResult(value.currentResult))
  ) {
    return null;
  }

  return value as PhraseChallengeDraft;
}

export function clearPhraseChallengeDraft(): void {
  removeItem(PHRASE_CHALLENGE_KEY);
}

export function saveToeicChallengeDraft(
  draft: Omit<ToeicChallengeDraft, "version" | "mode" | "savedAt">,
): void {
  writeJson(TOEIC_CHALLENGE_KEY, {
    ...draft,
    version: 1,
    mode: "toeic",
    savedAt: new Date().toISOString(),
  } satisfies ToeicChallengeDraft);
}

export function loadToeicChallengeDraft(): ToeicChallengeDraft | null {
  const value = readJson(TOEIC_CHALLENGE_KEY);

  if (!isObject(value)) {
    return null;
  }

  if (
    value.version !== 1 ||
    value.mode !== "toeic" ||
    typeof value.savedAt !== "string" ||
    !isStringArray(value.questionIds) ||
    typeof value.currentIndex !== "number" ||
    typeof value.showResults !== "boolean" ||
    !(value.selectedPart === "all" || typeof value.selectedPart === "string") ||
    !(value.selectedDifficulty === "all" || typeof value.selectedDifficulty === "string") ||
    !Array.isArray(value.answers) ||
    !value.answers.every(isToeicAnswer) ||
    !(value.currentAnswer === null || isToeicAnswer(value.currentAnswer))
  ) {
    return null;
  }

  return value as ToeicChallengeDraft;
}

export function clearToeicChallengeDraft(): void {
  removeItem(TOEIC_CHALLENGE_KEY);
}
