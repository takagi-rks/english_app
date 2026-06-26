"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import {
  clearToeicChallengeDraft,
  loadToeicChallengeDraft,
  saveToeicChallengeDraft,
} from "@/lib/challenge-storage";
import {
  getToeicDifficultyLabel,
  getToeicPartLabel,
  parseToeicChoices,
  TOEIC_CHOICE_KEYS,
  TOEIC_DIFFICULTY_OPTIONS,
  TOEIC_PART_OPTIONS,
} from "@/lib/toeic";
import {
  createSupabaseClient,
  type ToeicChoiceKey,
  type ToeicDifficulty,
  type ToeicPart,
  type ToeicQuestion,
} from "@/lib/supabase";

type ToeicChallengeClientProps = {
  initialQuestions: ToeicQuestion[];
  initialErrorMessage: string | null;
};

type ChallengeAnswer = {
  question: ToeicQuestion;
  selectedChoice: ToeicChoiceKey;
  correctChoice: ToeicChoiceKey;
  isCorrect: boolean;
};

type GroupResult = {
  key: string;
  label: string;
  answerCount: number;
  correctCount: number;
  accuracy: number;
};

function shuffleQuestions(questions: ToeicQuestion[]): ToeicQuestion[] {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function toPercent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function computeGroupResults(
  answers: ChallengeAnswer[],
  groups: Array<{ key: string; label: string; predicate: (answer: ChallengeAnswer) => boolean }>,
): GroupResult[] {
  return groups
    .map((group) => {
      const targetAnswers = answers.filter(group.predicate);
      const correctCount = targetAnswers.filter((answer) => answer.isCorrect).length;

      return {
        key: group.key,
        label: group.label,
        answerCount: targetAnswers.length,
        correctCount,
        accuracy: toPercent(correctCount, targetAnswers.length),
      };
    })
    .filter((result) => result.answerCount > 0);
}

export function ToeicChallengeClient({
  initialQuestions,
  initialErrorMessage,
}: ToeicChallengeClientProps) {
  const [selectedPart, setSelectedPart] = useState<ToeicPart | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<ToeicDifficulty | "all">("all");
  const [challengeQuestions, setChallengeQuestions] = useState<ToeicQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<ChallengeAnswer | null>(null);
  const [answers, setAnswers] = useState<ChallengeAnswer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedDraftRef = useRef(false);

  const availableQuestions = useMemo(
    () =>
      initialQuestions.filter(
        (question) =>
          parseToeicChoices(question.choices) !== null &&
          (selectedPart === "all" || question.part === selectedPart) &&
          (selectedDifficulty === "all" || question.difficulty === selectedDifficulty),
      ),
    [initialQuestions, selectedDifficulty, selectedPart],
  );
  const currentQuestion = challengeQuestions?.[currentIndex] ?? null;
  const currentChoices = parseToeicChoices(currentQuestion?.choices);
  const hasNextQuestion = challengeQuestions !== null && currentIndex < challengeQuestions.length - 1;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const partResults = computeGroupResults(
    answers,
    TOEIC_PART_OPTIONS.map((part) => ({
      key: part,
      label: getToeicPartLabel(part),
      predicate: (answer: ChallengeAnswer) => answer.question.part === part,
    })),
  );
  const difficultyResults = computeGroupResults(
    answers,
    TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => ({
      key: difficulty,
      label: getToeicDifficultyLabel(difficulty),
      predicate: (answer: ChallengeAnswer) => answer.question.difficulty === difficulty,
    })),
  );

  useEffect(() => {
    if (hasLoadedDraftRef.current) {
      return;
    }

    hasLoadedDraftRef.current = true;
    const timerId = window.setTimeout(() => {
      const draft = loadToeicChallengeDraft();

      if (!draft) {
        return;
      }

      const questionById = new Map(initialQuestions.map((question) => [question.id, question]));
      const restoredQuestions = draft.questionIds
        .map((questionId) => questionById.get(questionId))
        .filter((question): question is ToeicQuestion => question !== undefined);
      const restoreAnswer = (answer: (typeof draft.answers)[number]): ChallengeAnswer | null => {
        const question = questionById.get(answer.questionId);

        if (!question) {
          return null;
        }

        return {
          question,
          selectedChoice: answer.selectedChoice,
          correctChoice: answer.correctChoice,
          isCorrect: answer.isCorrect,
        };
      };
      const restoredAnswers = draft.answers
        .map(restoreAnswer)
        .filter((answer): answer is ChallengeAnswer => answer !== null);
      const restoredCurrentAnswer = draft.currentAnswer ? restoreAnswer(draft.currentAnswer) : null;

      if (restoredQuestions.length === 0) {
        clearToeicChallengeDraft();
        return;
      }

      setSelectedPart(draft.selectedPart);
      setSelectedDifficulty(draft.selectedDifficulty);
      setChallengeQuestions(restoredQuestions);
      setCurrentIndex(Math.min(draft.currentIndex, restoredQuestions.length - 1));
      setCurrentAnswer(restoredCurrentAnswer);
      setAnswers(restoredAnswers);
      setShowResults(draft.showResults);
      setMessage("途中のTOEICチャレンジを再開しました。");
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [initialQuestions]);

  function startChallenge() {
    setChallengeQuestions(shuffleQuestions(availableQuestions).slice(0, 10));
    setCurrentIndex(0);
    setCurrentAnswer(null);
    setAnswers([]);
    setShowResults(false);
    setMessage(null);
    clearToeicChallengeDraft();
  }

  async function selectChoice(choice: ToeicChoiceKey) {
    if (!currentQuestion || !currentChoices) {
      setMessage("回答できるTOEIC問題がありません。");
      return;
    }

    const nextAnswer: ChallengeAnswer = {
      question: currentQuestion,
      selectedChoice: choice,
      correctChoice: currentQuestion.correct_choice,
      isCorrect: choice === currentQuestion.correct_choice,
    };

    setCurrentAnswer(nextAnswer);
    setAnswers((current) => [...current, nextAnswer]);

    if (nextAnswer.isCorrect) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("toeic_practice_logs").insert({
        question_id: currentQuestion.id,
        selected_choice: choice,
        correct_choice: currentQuestion.correct_choice,
        is_correct: nextAnswer.isCorrect,
        practiced_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`TOEIC履歴の保存に失敗しました: ${error.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`TOEIC履歴の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  function moveNext() {
    if (!hasNextQuestion) {
      setShowResults(true);
      clearToeicChallengeDraft();
      return;
    }

    setCurrentIndex((index) => index + 1);
    setCurrentAnswer(null);
    setMessage(null);
  }

  function interruptChallenge() {
    if (!challengeQuestions) {
      return;
    }

    const shouldInterrupt = window.confirm(
      "TOEICチャレンジを中断して、続きから再開できるように保存しますか？",
    );

    if (!shouldInterrupt) {
      return;
    }

    saveToeicChallengeDraft({
      selectedPart,
      selectedDifficulty,
      questionIds: challengeQuestions.map((question) => question.id),
      currentIndex,
      currentAnswer: currentAnswer
        ? {
            questionId: currentAnswer.question.id,
            selectedChoice: currentAnswer.selectedChoice,
            correctChoice: currentAnswer.correctChoice,
            isCorrect: currentAnswer.isCorrect,
          }
        : null,
      answers: answers.map((answer) => ({
        questionId: answer.question.id,
        selectedChoice: answer.selectedChoice,
        correctChoice: answer.correctChoice,
        isCorrect: answer.isCorrect,
      })),
      showResults,
    });
    setChallengeQuestions(null);
    setCurrentAnswer(null);
    setAnswers([]);
    setShowResults(false);
    setMessage("TOEICチャレンジを中断しました。ホーム画面から続きに戻れます。");
  }

  function resetChallenge() {
    setChallengeQuestions(null);
    setCurrentIndex(0);
    setCurrentAnswer(null);
    setAnswers([]);
    setShowResults(false);
    setMessage(null);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (initialQuestions.length === 0) {
    return <div className="emptyState">TOEIC問題が登録されていません。</div>;
  }

  if (challengeQuestions === null) {
    return (
      <section className="panel">
        <div className="field">
          <label htmlFor="toeic-challenge-part">Part</label>
          <select
            className="select"
            id="toeic-challenge-part"
            value={selectedPart}
            onChange={(event) => setSelectedPart(event.target.value as ToeicPart | "all")}
          >
            <option value="all">全Part</option>
            {TOEIC_PART_OPTIONS.map((part) => (
              <option key={part} value={part}>
                {getToeicPartLabel(part)}
              </option>
            ))}
          </select>
        </div>
        <div className="field formGap">
          <label htmlFor="toeic-challenge-difficulty">難易度</label>
          <select
            className="select"
            id="toeic-challenge-difficulty"
            value={selectedDifficulty}
            onChange={(event) => setSelectedDifficulty(event.target.value as ToeicDifficulty | "all")}
          >
            <option value="all">全レベル</option>
            {TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {getToeicDifficultyLabel(difficulty)}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">対象問題: {availableQuestions.length}件 / 出題数: 最大10問</p>
        <button
          className="button buttonPrimaryAction formGap"
          type="button"
          onClick={startChallenge}
          disabled={availableQuestions.length === 0}
        >
          TOEIC 10問チャレンジを開始する
        </button>
      </section>
    );
  }

  if (challengeQuestions.length === 0) {
    return (
      <section className="panel">
        <div className="emptyState">選択した条件に一致する有効なTOEIC問題がありません。</div>
        <button className="button buttonSecondary formGap" type="button" onClick={resetChallenge}>
          条件を選び直す
        </button>
      </section>
    );
  }

  if (showResults) {
    return (
      <section className="panel">
        <h2 className="sectionTitle">TOEICチャレンジ結果</h2>
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">回答数</span>
            <strong>{answers.length}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正解数</span>
            <strong>{correctCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正答率</span>
            <strong>{toPercent(correctCount, answers.length)}%</strong>
          </div>
        </div>
        <section className="sectionGap">
          <h3 className="sectionTitle">Part別結果</h3>
          <div className="chartList">
            {partResults.map((result) => (
              <div className="chartRow" key={result.key}>
                <span>{result.label}</span>
                <div className="barTrack">
                  <div className="barFill" style={{ width: `${result.accuracy}%` }} />
                </div>
                <span>
                  {result.correctCount}/{result.answerCount} ({result.accuracy}%)
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="sectionGap">
          <h3 className="sectionTitle">難易度別結果</h3>
          <div className="chartList">
            {difficultyResults.map((result) => (
              <div className="chartRow" key={result.key}>
                <span>{result.label}</span>
                <div className="barTrack">
                  <div className="barFill" style={{ width: `${result.accuracy}%` }} />
                </div>
                <span>
                  {result.correctCount}/{result.answerCount} ({result.accuracy}%)
                </span>
              </div>
            ))}
          </div>
        </section>
        <div className="buttonRow formGap">
          <button className="button buttonPrimaryAction" type="button" onClick={startChallenge}>
            もう一度挑戦する
          </button>
          <button className="button buttonSecondary" type="button" onClick={resetChallenge}>
            条件を選び直す
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="metaText">
        {currentIndex + 1} / {challengeQuestions.length}
      </p>
      {currentQuestion && currentChoices ? (
        <>
          <p className="metaText">
            {getToeicPartLabel(currentQuestion.part)} / {getToeicDifficultyLabel(currentQuestion.difficulty)}
          </p>
          <div className="phraseBox">
            <p className="phraseCardText phraseCardJapanese">{currentQuestion.question_text}</p>
          </div>
          <div className="chartList formGap">
            {TOEIC_CHOICE_KEYS.map((choiceKey) => {
              const isSelected = currentAnswer?.selectedChoice === choiceKey;
              const isCorrectChoice = currentAnswer?.correctChoice === choiceKey;

              return (
                <button
                  className={`button ${currentAnswer ? "buttonSecondary" : "buttonPrimaryAction"}`}
                  type="button"
                  key={choiceKey}
                  onClick={() => selectChoice(choiceKey)}
                  disabled={currentAnswer !== null || isSaving}
                >
                  {choiceKey}. {currentChoices[choiceKey]}
                  {isSelected ? " / 選択" : ""}
                  {isCorrectChoice ? " / 正解" : ""}
                </button>
              );
            })}
          </div>
          {message ? <p className="metaText">{message}</p> : null}
          {currentAnswer ? (
            <section className="answerBlock sectionGap" aria-live="polite">
              <p>
                <strong>判定:</strong> {currentAnswer.isCorrect ? "正解" : "不正解"}
              </p>
              <p>
                <strong>正解:</strong> {currentAnswer.correctChoice}
              </p>
              <p>
                <strong>解説:</strong> {currentQuestion.explanation || "解説は登録されていません。"}
              </p>
              <button className="button buttonPrimaryAction formGap" type="button" onClick={moveNext}>
                {hasNextQuestion ? "次の問題へ" : "結果を見る"}
              </button>
            </section>
          ) : null}
          <div className="buttonRow formGap">
            <button className="button buttonSecondary" type="button" onClick={interruptChallenge} disabled={isSaving}>
              中断する
            </button>
          </div>
        </>
      ) : (
        <div className="emptyState">表示できるTOEIC問題がありません。</div>
      )}
    </section>
  );
}
