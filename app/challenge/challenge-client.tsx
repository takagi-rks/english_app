"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import {
  clearPhraseChallengeDraft,
  loadPhraseChallengeDraft,
  savePhraseChallengeDraft,
} from "@/lib/challenge-storage";
import { getLevelLabel, getSceneLabel } from "@/lib/constants";
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
  const [showResults, setShowResults] = useState(false);
  const hasLoadedDraftRef = useRef(false);

  const sceneOptions = useMemo(
    () => Array.from(new Set(phrases.map((phrase) => phrase.scene))).sort((a, b) => a.localeCompare(b, "ja")),
    [phrases],
  );
  const currentPhrase = challengePhrases?.[currentIndex] ?? null;
  const hasNextQuestion = challengePhrases !== null && currentIndex < challengePhrases.length - 1;
  const isFinished = challengePhrases !== null && challengePhrases.length > 0 && showResults;
  const summary = useMemo(() => {
    const correctCount = results.filter((result) => result.isCorrect).length;

    return {
      answerCount: results.length,
      averageScore: averageScore(results.map((result) => result.score)),
      correctCount,
      accuracy: toPercent(correctCount, results.length),
    };
  }, [results]);

  useEffect(() => {
    if (hasLoadedDraftRef.current) {
      return;
    }

    hasLoadedDraftRef.current = true;
    const timerId = window.setTimeout(() => {
      const draft = loadPhraseChallengeDraft();

      if (!draft) {
        return;
      }

      const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
      const restoredPhrases = draft.phraseIds
        .map((phraseId) => phraseById.get(phraseId))
        .filter((phrase): phrase is Phrase => phrase !== undefined);

      if (restoredPhrases.length === 0) {
        clearPhraseChallengeDraft();
        return;
      }

      setSelectedScene(draft.selectedScene);
      setChallengePhrases(restoredPhrases);
      setCurrentIndex(Math.min(draft.currentIndex, restoredPhrases.length - 1));
      setAnswer(draft.answer);
      setCurrentResult(draft.currentResult);
      setResults(draft.results);
      setShowResults(draft.showResults);
      setMessage("途中のチャレンジを再開しました。");
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [phrases]);

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
    setShowResults(false);
    clearPhraseChallengeDraft();
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

    if (result.isCorrect) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

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
    if (!hasNextQuestion) {
      setShowResults(true);
      clearPhraseChallengeDraft();
      return;
    }

    setAnswer("");
    setCurrentResult(null);
    setMessage(null);
    setCurrentIndex((index) => index + 1);
  }

  function interruptChallenge() {
    if (!challengePhrases) {
      return;
    }

    const shouldInterrupt = window.confirm("チャレンジを中断して、続きから再開できるように保存しますか？");

    if (!shouldInterrupt) {
      return;
    }

    savePhraseChallengeDraft({
      selectedScene,
      phraseIds: challengePhrases.map((phrase) => phrase.id),
      currentIndex,
      answer,
      currentResult,
      results,
      showResults,
    });
    setChallengePhrases(null);
    setCurrentResult(null);
    setAnswer("");
    setShowResults(false);
    setMessage("チャレンジを中断しました。ホーム画面から続きに戻れます。");
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
                {getSceneLabel(scene)}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">対象教材: {selectedCount}件 / 出題数: 最大10問</p>
        <button
          className="button buttonPrimaryAction formGap"
          type="button"
          onClick={startChallenge}
          disabled={selectedCount === 0}
        >
          10問チャレンジを開始する
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
        <div className="buttonRow formGap">
          <button className="button buttonPrimaryAction" type="button" onClick={startChallenge}>
            もう一度挑戦する
          </button>
          <Link className="button buttonSecondary" href="/practice">
            通常練習へ
          </Link>
        </div>
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
              {getSceneLabel(currentPhrase.scene)} / {getLevelLabel(currentPhrase.level)}
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
              <button className="button buttonPrimaryAction" type="button" onClick={moveNext}>
                {hasNextQuestion ? "次の問題へ" : "結果を見る"}
              </button>
            ) : (
              <button className="button buttonPrimaryAction" type="button" onClick={submitAnswer} disabled={isSaving}>
                {isSaving ? "保存中" : "回答を確認する"}
              </button>
            )}
            <button className="button buttonSecondary" type="button" onClick={interruptChallenge} disabled={isSaving}>
              中断する
            </button>
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
