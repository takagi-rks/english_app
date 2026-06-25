import type { PracticeLog } from "./supabase";

export type LogForStats = Pick<PracticeLog, "score" | "is_correct" | "practiced_at"> & {
  scene?: string;
};

export type LearningSummary = {
  todayCount: number;
  totalCount: number;
  currentStreak: number;
  bestStreak: number;
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
