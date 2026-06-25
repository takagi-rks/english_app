export type ScoreBreakdown = {
  score: number;
  label: string;
};

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCase(value: string): string {
  return normalizeSpaces(value).toLowerCase();
}

function normalizeLoose(value: string): string {
  return normalizeCase(value)
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

export function scoreAnswer(userAnswer: string, correctAnswer: string): ScoreBreakdown {
  const exactUser = normalizeSpaces(userAnswer);
  const exactCorrect = normalizeSpaces(correctAnswer);

  if (!exactUser) {
    return { score: 0, label: "回答が空です" };
  }

  if (exactUser === exactCorrect) {
    return { score: 100, label: "完全一致" };
  }

  const caseUser = normalizeCase(userAnswer);
  const caseCorrect = normalizeCase(correctAnswer);

  if (caseUser === caseCorrect) {
    return { score: 95, label: "大文字小文字のみ違います" };
  }

  const looseUser = normalizeLoose(userAnswer);
  const looseCorrect = normalizeLoose(correctAnswer);

  if (looseUser === looseCorrect) {
    return { score: 90, label: "記号や大文字小文字のみ違います" };
  }

  const maxLength = Math.max(looseUser.length, looseCorrect.length);

  if (maxLength === 0) {
    return { score: 0, label: "採点できる文字がありません" };
  }

  const distance = levenshteinDistance(looseUser, looseCorrect);
  const similarity = Math.max(0, 1 - distance / maxLength);
  const score = Math.round(similarity * 85);

  return {
    score,
    label: score >= 70 ? "かなり近い回答です" : "正解英文と差があります",
  };
}
