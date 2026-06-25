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
  const [selectedScene, setSelectedScene] = useState("all");
  const [challengePhrases, setChallengePhrases] = useState<Phrase[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [currentResult, setCurrentResult] = useState<ChallengeResult | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isSaving, setIsSaving] = useState(false);

  const sceneOptions = useMemo(
    () => Array.from(new Set(phrases.map((phrase) => phrase.scene))).sort((a, b) => a.localeCompare(b, "ja")),
    [phrases],
  );
  const currentPhrase = challengePhrases?.[currentIndex] ?? null;
  const isFinished =
    challengePhrases !== null && challengePhrases.length > 0 && results.length === challengePhrases.length;
  const summary = useMemo(() => {
    const correctCount = results.filter((result) => result.isCorrect).length;

    return {
      answerCount: results.length,
      averageScore: averageScore(results.map((result) => result.score)),
      correctCount,
      accuracy: toPercent(correctCount, results.length),
    };
  }, [results]);

  function shufflePhrases(targetPhrases: Phrase[]): Phrase[] {
    const shuffled = [...targetPhrases];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
  }

  function startChallenge() {
    const filteredPhrases =
      selectedScene === "all" ? phrases : phrases.filter((phrase) => phrase.scene === selectedScene);

    setChallengePhrases(shufflePhrases(filteredPhrases).slice(0, 10));
    setCurrentIndex(0);
    setAnswer("");
    setCurrentResult(null);
    setResults([]);
    setMessage(null);
  }

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

  if (challengePhrases === null) {
    const selectedCount =
      selectedScene === "all"
        ? phrases.length
        : phrases.filter((phrase) => phrase.scene === selectedScene).length;

    return (
      <section className="panel">
        <div className="field">
          <label htmlFor="challenge-scene">カテゴリ</label>
          <select
            className="select"
            id="challenge-scene"
            value={selectedScene}
            onChange={(event) => setSelectedScene(event.target.value)}
          >
            <option value="all">全カテゴリ</option>
            {sceneOptions.map((scene) => (
              <option key={scene} value={scene}>
                {scene}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">対象教材: {selectedCount}件 / 出題数: 最大10問</p>
        <button className="button formGap" type="button" onClick={startChallenge} disabled={selectedCount === 0}>
          チャレンジ開始
        </button>
      </section>
    );
  }

  if (challengePhrases.length === 0) {
    return (
      <section className="panel">
        <div className="emptyState">選択したカテゴリに教材がありません。</div>
        <button className="button buttonSecondary formGap" type="button" onClick={() => setChallengePhrases(null)}>
          カテゴリを選び直す
        </button>
      </section>
    );
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
        <button className="button buttonSecondary formGap" type="button" onClick={() => setChallengePhrases(null)}>
          もう一度カテゴリを選ぶ
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="metaText">
        {currentIndex + 1} / {challengePhrases.length}
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
