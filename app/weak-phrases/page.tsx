import Link from "next/link";
import { averageScore, toPercent } from "@/lib/learning";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type WeakPhrase = {
  phraseId: string;
  japanese: string;
  correctEnglish: string;
  answerCount: number;
  correctCount: number;
  accuracy: number;
  averageScore: number;
};

type PracticeLogForWeakPhrase = {
  phrase_id: string | null;
  japanese: string;
  correct_english: string;
  score: number;
  is_correct: boolean;
};

async function getWeakPhrases(): Promise<{
  weakPhrases: WeakPhrase[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_practice_logs")
      .select("phrase_id, japanese, correct_english, score, is_correct");

    if (error) {
      return {
        weakPhrases: [],
        errorMessage: `苦手フレーズの取得に失敗しました: ${error.message}`,
      };
    }

    const grouped = new Map<
      string,
      {
        japanese: string;
        correctEnglish: string;
        scores: number[];
        correctCount: number;
      }
    >();

    for (const log of data satisfies PracticeLogForWeakPhrase[]) {
      if (!log.phrase_id) {
        continue;
      }

      const current = grouped.get(log.phrase_id) ?? {
        japanese: log.japanese,
        correctEnglish: log.correct_english,
        scores: [],
        correctCount: 0,
      };

      current.scores.push(log.score);
      current.correctCount += log.is_correct ? 1 : 0;
      grouped.set(log.phrase_id, current);
    }

    const weakPhrases = Array.from(grouped.entries())
      .map(([phraseId, value]) => {
        const answerCount = value.scores.length;
        const accuracy = toPercent(value.correctCount, answerCount);

        return {
          phraseId,
          japanese: value.japanese,
          correctEnglish: value.correctEnglish,
          answerCount,
          correctCount: value.correctCount,
          accuracy,
          averageScore: averageScore(value.scores),
        };
      })
      .filter((phrase) => phrase.answerCount >= 2 && phrase.accuracy < 80)
      .sort((a, b) => a.accuracy - b.accuracy || b.answerCount - a.answerCount);

    return { weakPhrases, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      weakPhrases: [],
      errorMessage: `苦手フレーズの取得に失敗しました: ${message}`,
    };
  }
}

export default async function WeakPhrasesPage() {
  const { weakPhrases, errorMessage } = await getWeakPhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>苦手復習</h1>
        <p>回答回数2回以上、正答率80%未満のフレーズを自動で抽出します。</p>
      </div>

      {errorMessage ? <div className="errorMessage">{errorMessage}</div> : null}

      {!errorMessage && weakPhrases.length === 0 ? (
        <div className="emptyState">現在、苦手フレーズはありません。</div>
      ) : null}

      {weakPhrases.length > 0 ? (
        <div className="tableWrap">
          <table className="historyTable">
            <thead>
              <tr>
                <th>日本語</th>
                <th>正解英文</th>
                <th>回答回数</th>
                <th>正解数</th>
                <th>正答率</th>
                <th>平均点</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {weakPhrases.map((phrase) => (
                <tr key={phrase.phraseId}>
                  <td>{phrase.japanese}</td>
                  <td>{phrase.correctEnglish}</td>
                  <td>{phrase.answerCount}</td>
                  <td>{phrase.correctCount}</td>
                  <td>{phrase.accuracy}%</td>
                  <td>{phrase.averageScore}</td>
                  <td>
                    <Link className="button buttonSmall" href={`/practice?phraseId=${phrase.phraseId}`}>
                      練習する
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
