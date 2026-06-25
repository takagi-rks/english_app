"use client";

import { useMemo, useState } from "react";
import { averageScore, toPercent } from "@/lib/learning";
import { scoreAnswer } from "@/lib/scoring";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

type ChallengeResult = {
  phraseId: string;
  japanese: string;
  correctEnglish: string;
  userAnswer: string;
  score: number;
  isCorrect: boolean;
};

type ChallengeClientProps = {
  phrases: Phrase[];
  initialErrorMessage: string | null;
};

export function ChallengeClient({ phrases, initialErrorMessage }: ChallengeClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [currentResult, setCurrentResult] = useState<ChallengeResult | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isSaving, setIsSaving] = useState(false);

  const currentPhrase = phrases[currentIndex] ?? null;
  const isFinished = phrases.length > 0 && results.length === phrases.length;
  const summary = useMemo(() => {
    const correctCount = results.filter((result) => result.isCorrect).length;

    return {
      answerCount: results.length,
      averageScore: averageScore(results.map((result) => result.score)),
      correctCount,
      accuracy: toPercent(correctCount, results.length),
    };
  }, [results]);

  async function submitAnswer() {
    if (!currentPhrase) {
      setMessage("採点できる教材がありません。");
      return;
    }

    const breakdown = scoreAnswer(answer, currentPhrase.english);
    const result: ChallengeResult = {
      phraseId: currentPhrase.id,
      japanese: currentPhrase.japanese,
      correctEnglish: currentPhrase.english,
      userAnswer: answer,
      score: breakdown.score,
      isCorrect: breakdown.score >= 80,
    };

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("english_practice_logs").insert({
        phrase_id: currentPhrase.id,
        scene: currentPhrase.scene,
        japanese: currentPhrase.japanese,
        correct_english: currentPhrase.english,
        user_answer: answer,
        score: result.score,
        is_correct: result.isCorrect,
        practiced_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`履歴の保存に失敗しました: ${error.message}`);
        return;
      }

      setCurrentResult(result);
      setResults((current) => [...current, result]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`履歴の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  function moveNext() {
    setAnswer("");
    setCurrentResult(null);
    setMessage(null);
    setCurrentIndex((index) => index + 1);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (phrases.length === 0) {
    return <div className="emptyState">チャレンジ用の教材が登録されていません。</div>;
  }

  if (isFinished) {
    return (
      <section className="panel">
        <h2 className="sectionTitle">チャレンジ結果</h2>
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">回答数</span>
            <strong>{summary.answerCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">平均点</span>
            <strong>{summary.averageScore}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正解数</span>
            <strong>{summary.correctCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正答率</span>
            <strong>{summary.accuracy}%</strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="metaText">
        {currentIndex + 1} / {phrases.length}
      </p>
      {currentPhrase ? (
        <>
          <div className="phraseBox">
            <span className="phraseLabel">
              {currentPhrase.scene} / {currentPhrase.level}
            </span>
            <p className="japanesePhrase">{currentPhrase.japanese}</p>
            {currentPhrase.hint ? <p className="metaText">ヒント: {currentPhrase.hint}</p> : null}
          </div>
          <div className="field formGap">
            <label htmlFor="challenge-answer">英語で回答</label>
            <textarea
              className="textarea"
              id="challenge-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={currentResult !== null}
            />
          </div>
          <div className="buttonRow formGap">
            {currentResult ? (
              <button className="button" type="button" onClick={moveNext}>
                次の問題へ
              </button>
            ) : (
              <button className="button" type="button" onClick={submitAnswer} disabled={isSaving}>
                {isSaving ? "保存中" : "回答する"}
              </button>
            )}
          </div>
          {message ? <p className="metaText">{message}</p> : null}
          {currentResult ? (
            <div className="answerBlock sectionGap" aria-live="polite">
              <p>
                <strong>点数:</strong> {currentResult.score}
              </p>
              <p>
                <strong>正解:</strong> {currentResult.correctEnglish}
              </p>
              <p>
                <strong>あなたの回答:</strong> {currentResult.userAnswer || "未入力"}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
