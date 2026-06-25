import type { PracticeLog } from "./supabase";

export type LogForStats = Pick<PracticeLog, "score" | "is_correct" | "practiced_at"> & {
  scene?: string;
  pronunciation_score?: number | null;
};

export type LearningSummary = {
  todayCount: number;
  totalCount: number;
  currentStreak: number;
  bestStreak: number;
};

export type LevelProgress = {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  progressPercent: number;
};

export type Badge = {
  id: string;
  label: string;
  description: string;
  achieved: boolean;
};

export type CalendarDay = {
  dateKey: string;
  answerCount: number;
  intensity: 0 | 1 | 2 | 3;
};

export type PronunciationEvaluation = {
  score: number;
  wordMatchRate: number;
  orderScore: number;
  similarityScore: number;
  mismatchedWords: string[];
};

export function getJstDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return getJstDateKey(date);
}

export function getRelativeJstDateKey(daysFromToday: number, now: Date = new Date()): string {
  return addDays(getJstDateKey(now), daysFromToday);
}

export function toPercent(correct: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((correct / total) * 100);
}

export function averageScore(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function computeLearningSummary(logs: LogForStats[], now: Date = new Date()): LearningSummary {
  const todayKey = getJstDateKey(now);
  const yesterdayKey = addDays(todayKey, -1);
  const learningDays = Array.from(new Set(logs.map((log) => getJstDateKey(log.practiced_at)))).sort();
  const learningDaySet = new Set(learningDays);
  const todayCount = logs.filter((log) => getJstDateKey(log.practiced_at) === todayKey).length;

  let currentStreak = 0;
  let cursor = learningDaySet.has(todayKey) ? todayKey : yesterdayKey;

  while (learningDaySet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let bestStreak = 0;
  let runningStreak = 0;
  let previousDay: string | null = null;

  for (const day of learningDays) {
    if (previousDay && addDays(previousDay, 1) === day) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    bestStreak = Math.max(bestStreak, runningStreak);
    previousDay = day;
  }

  return {
    todayCount,
    totalCount: logs.length,
    currentStreak,
    bestStreak,
  };
}

export function computeLevelProgress(logs: LogForStats[]): LevelProgress {
  const totalXp = logs.reduce((sum, log) => {
    const answerXp = 10;
    const correctXp = log.is_correct ? 10 : 0;
    const perfectXp = log.score === 100 ? 20 : 0;
    const pronunciationXp = (log.pronunciation_score ?? 0) >= 80 ? 10 : 0;

    return sum + answerXp + correctXp + perfectXp + pronunciationXp;
  }, 0);
  const level = Math.floor(totalXp / 100) + 1;
  const xpIntoLevel = totalXp % 100;

  return {
    totalXp,
    level,
    xpIntoLevel,
    xpToNextLevel: 100 - xpIntoLevel,
    progressPercent: xpIntoLevel,
  };
}

export function computeBadges(logs: LogForStats[], summary: LearningSummary): Badge[] {
  const totalCount = logs.length;
  const perfectCount = logs.filter((log) => log.score === 100).length;
  const pronunciationCount = logs.filter((log) => log.pronunciation_score !== null && log.pronunciation_score !== undefined).length;
  const goodPronunciationCount = logs.filter((log) => (log.pronunciation_score ?? 0) >= 80).length;
  const correctCount = logs.filter((log) => log.is_correct).length;

  return [
    {
      id: "first-step",
      label: "First Step",
      description: "初回回答",
      achieved: totalCount >= 1,
    },
    {
      id: "ten-questions",
      label: "10 Questions",
      description: "累計10問回答",
      achieved: totalCount >= 10,
    },
    {
      id: "hundred-questions",
      label: "100 Questions",
      description: "累計100問回答",
      achieved: totalCount >= 100,
    },
    {
      id: "perfect-answer",
      label: "Perfect Answer",
      description: "100点を1回以上",
      achieved: perfectCount >= 1,
    },
    {
      id: "perfect-ten",
      label: "Perfect 10",
      description: "正解10件以上",
      achieved: correctCount >= 10,
    },
    {
      id: "three-day-streak",
      label: "3 Day Streak",
      description: "3日連続学習",
      achieved: summary.bestStreak >= 3,
    },
    {
      id: "seven-day-streak",
      label: "7 Day Streak",
      description: "7日連続学習",
      achieved: summary.bestStreak >= 7,
    },
    {
      id: "pronunciation-starter",
      label: "Pronunciation Starter",
      description: "発音評価を1回以上",
      achieved: pronunciationCount >= 1,
    },
    {
      id: "good-pronunciation",
      label: "Good Pronunciation",
      description: "発音評価80点以上を1回以上",
      achieved: goodPronunciationCount >= 1,
    },
  ];
}

export function computeCalendarDays(logs: LogForStats[], days = 35, now: Date = new Date()): CalendarDay[] {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const dateKey = getJstDateKey(log.practiced_at);
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const dateKey = getRelativeJstDateKey(index - (days - 1), now);
    const answerCount = counts.get(dateKey) ?? 0;
    const intensity = answerCount >= 10 ? 3 : answerCount >= 5 ? 2 : answerCount >= 1 ? 1 : 0;

    return {
      dateKey,
      answerCount,
      intensity,
    };
  });
}

function normalizeWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

export function evaluatePronunciation(recognizedSpeech: string, correctEnglish: string): PronunciationEvaluation {
  const recognizedWords = normalizeWords(recognizedSpeech);
  const correctWords = normalizeWords(correctEnglish);
  const recognizedWordSet = new Set(recognizedWords);
  const matchedWordCount = correctWords.filter((word) => recognizedWordSet.has(word)).length;
  const orderedMatchCount = correctWords.filter((word, index) => recognizedWords[index] === word).length;
  const wordMatchRate = toPercent(matchedWordCount, correctWords.length);
  const orderScore = toPercent(orderedMatchCount, correctWords.length);
  const normalizedRecognized = recognizedWords.join(" ");
  const normalizedCorrect = correctWords.join(" ");
  const maxLength = Math.max(normalizedRecognized.length, normalizedCorrect.length);
  const distance = maxLength === 0 ? 0 : levenshteinDistance(normalizedRecognized, normalizedCorrect);
  const similarityScore = maxLength === 0 ? 0 : Math.round(Math.max(0, 1 - distance / maxLength) * 100);
  const mismatchedWords = correctWords.filter((word) => !recognizedWordSet.has(word));

  return {
    score: Math.round(similarityScore * 0.5 + wordMatchRate * 0.3 + orderScore * 0.2),
    wordMatchRate,
    orderScore,
    similarityScore,
    mismatchedWords: Array.from(new Set(mismatchedWords)),
  };
}
