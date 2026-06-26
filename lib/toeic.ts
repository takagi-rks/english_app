import type {
  Json,
  ToeicChoiceKey,
  ToeicChoices,
  ToeicDifficulty,
  ToeicPart,
  ToeicPracticeLog,
  ToeicQuestion,
} from "@/lib/supabase";

export const TOEIC_PART_OPTIONS: readonly ToeicPart[] = [
  "part1",
  "part2",
  "part3",
  "part4",
  "part5",
  "part6",
  "part7",
];

export const TOEIC_PART_LABELS: Record<ToeicPart, string> = {
  part1: "Part 1 写真描写",
  part2: "Part 2 応答問題",
  part3: "Part 3 会話問題",
  part4: "Part 4 説明文問題",
  part5: "Part 5 短文穴埋め",
  part6: "Part 6 長文穴埋め",
  part7: "Part 7 読解問題",
};

export const TOEIC_DIFFICULTY_OPTIONS: readonly ToeicDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

export const TOEIC_DIFFICULTY_LABELS: Record<ToeicDifficulty, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};

export const TOEIC_CHOICE_KEYS: readonly ToeicChoiceKey[] = ["A", "B", "C", "D"];

export function getToeicPartLabel(part: ToeicPart): string {
  return TOEIC_PART_LABELS[part];
}

export function getToeicDifficultyLabel(difficulty: ToeicDifficulty): string {
  return TOEIC_DIFFICULTY_LABELS[difficulty];
}

export function isToeicPart(value: string): value is ToeicPart {
  return TOEIC_PART_OPTIONS.includes(value as ToeicPart);
}

export function isToeicDifficulty(value: string): value is ToeicDifficulty {
  return TOEIC_DIFFICULTY_OPTIONS.includes(value as ToeicDifficulty);
}

export function isToeicChoiceKey(value: string): value is ToeicChoiceKey {
  return TOEIC_CHOICE_KEYS.includes(value as ToeicChoiceKey);
}

export function parseToeicChoices(value: unknown): ToeicChoices | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const choices = TOEIC_CHOICE_KEYS.reduce<Partial<ToeicChoices>>((current, key) => {
    const choice = source[key];

    if (typeof choice === "string" && choice.trim()) {
      current[key] = choice;
    }

    return current;
  }, {});

  if (TOEIC_CHOICE_KEYS.every((key) => typeof choices[key] === "string")) {
    return {
      A: choices.A ?? "",
      B: choices.B ?? "",
      C: choices.C ?? "",
      D: choices.D ?? "",
    };
  }

  return null;
}

export function toeicChoicesToJson(choices: ToeicChoices): Json {
  return {
    A: choices.A,
    B: choices.B,
    C: choices.C,
    D: choices.D,
  };
}

export function parseToeicTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
}

export function getToeicQuestionKey(
  question: Pick<ToeicQuestion, "part" | "question_text" | "difficulty">,
): string {
  return [question.part, question.question_text.trim().toLowerCase(), question.difficulty].join("\u0000");
}

export type ToeicStats = {
  totalCount: number;
  correctCount: number;
  accuracy: number;
  partStats: Array<{ key: ToeicPart; label: string; totalCount: number; correctCount: number; accuracy: number }>;
  difficultyStats: Array<{
    key: ToeicDifficulty;
    label: string;
    totalCount: number;
    correctCount: number;
    accuracy: number;
  }>;
};

function toPercent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function computeToeicStats(logs: ToeicPracticeLog[], questions: ToeicQuestion[]): ToeicStats {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const correctCount = logs.filter((log) => log.is_correct).length;

  return {
    totalCount: logs.length,
    correctCount,
    accuracy: toPercent(correctCount, logs.length),
    partStats: TOEIC_PART_OPTIONS.map((part) => {
      const targetLogs = logs.filter((log) => questionById.get(log.question_id ?? "")?.part === part);
      const partCorrectCount = targetLogs.filter((log) => log.is_correct).length;

      return {
        key: part,
        label: getToeicPartLabel(part),
        totalCount: targetLogs.length,
        correctCount: partCorrectCount,
        accuracy: toPercent(partCorrectCount, targetLogs.length),
      };
    }),
    difficultyStats: TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => {
      const targetLogs = logs.filter(
        (log) => questionById.get(log.question_id ?? "")?.difficulty === difficulty,
      );
      const difficultyCorrectCount = targetLogs.filter((log) => log.is_correct).length;

      return {
        key: difficulty,
        label: getToeicDifficultyLabel(difficulty),
        totalCount: targetLogs.length,
        correctCount: difficultyCorrectCount,
        accuracy: toPercent(difficultyCorrectCount, targetLogs.length),
      };
    }),
  };
}
