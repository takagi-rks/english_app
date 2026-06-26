"use client";

import { useMemo, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import {
  computeToeicStats,
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
  type ToeicPracticeLog,
  type ToeicQuestion,
} from "@/lib/supabase";

type ToeicClientProps = {
  initialQuestions: ToeicQuestion[];
  initialLogs: ToeicPracticeLog[];
  initialErrorMessage: string | null;
};

type AnswerResult = {
  selectedChoice: ToeicChoiceKey;
  correctChoice: ToeicChoiceKey;
  isCorrect: boolean;
};

function pickRandomQuestion(questions: ToeicQuestion[], previousId?: string): ToeicQuestion | null {
  if (questions.length === 0) {
    return null;
  }

  const candidates =
    questions.length > 1 && previousId
      ? questions.filter((question) => question.id !== previousId)
      : questions;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] ?? null;
}

export function ToeicClient({ initialQuestions, initialLogs, initialErrorMessage }: ToeicClientProps) {
  const [questions] = useState<ToeicQuestion[]>(initialQuestions);
  const [logs, setLogs] = useState<ToeicPracticeLog[]>(initialLogs);
  const [selectedPart, setSelectedPart] = useState<ToeicPart | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<ToeicDifficulty | "all">("all");
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    () => pickRandomQuestion(initialQuestions)?.id ?? null,
  );
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isSaving, setIsSaving] = useState(false);

  const filteredQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          (selectedPart === "all" || question.part === selectedPart) &&
          (selectedDifficulty === "all" || question.difficulty === selectedDifficulty),
      ),
    [questions, selectedDifficulty, selectedPart],
  );
  const currentQuestion =
    filteredQuestions.find((question) => question.id === currentQuestionId) ??
    filteredQuestions[0] ??
    null;
  const currentChoices = parseToeicChoices(currentQuestion?.choices);
  const stats = useMemo(() => computeToeicStats(logs, questions), [logs, questions]);

  function setFilters(part: ToeicPart | "all", difficulty: ToeicDifficulty | "all") {
    const nextQuestions = questions.filter(
      (question) =>
        (part === "all" || question.part === part) &&
        (difficulty === "all" || question.difficulty === difficulty),
    );

    setSelectedPart(part);
    setSelectedDifficulty(difficulty);
    setCurrentQuestionId(pickRandomQuestion(nextQuestions)?.id ?? null);
    setAnswerResult(null);
    setMessage(null);
  }

  async function selectChoice(choice: ToeicChoiceKey) {
    if (!currentQuestion || !currentChoices) {
      setMessage("回答できるTOEIC問題がありません。");
      return;
    }

    const isCorrect = choice === currentQuestion.correct_choice;
    const nextResult: AnswerResult = {
      selectedChoice: choice,
      correctChoice: currentQuestion.correct_choice,
      isCorrect,
    };

    setAnswerResult(nextResult);
    if (isCorrect) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const payload = {
        question_id: currentQuestion.id,
        selected_choice: choice,
        correct_choice: currentQuestion.correct_choice,
        is_correct: isCorrect,
        practiced_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("toeic_practice_logs")
        .insert(payload)
        .select("id, question_id, selected_choice, correct_choice, is_correct, practiced_at")
        .single();

      if (error) {
        setMessage(`TOEIC履歴の保存に失敗しました: ${error.message}`);
        return;
      }

      setLogs((current) => [data, ...current]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`TOEIC履歴の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  function moveNext() {
    const nextQuestion = pickRandomQuestion(filteredQuestions, currentQuestion?.id);
    setCurrentQuestionId(nextQuestion?.id ?? null);
    setAnswerResult(null);
    setMessage(null);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  return (
    <div className="gridTwo">
      <aside className="panel">
        <div className="field">
          <label htmlFor="toeic-part">Part</label>
          <select
            className="select"
            id="toeic-part"
            value={selectedPart}
            onChange={(event) => setFilters(event.target.value as ToeicPart | "all", selectedDifficulty)}
          >
            <option value="all">すべて</option>
            {TOEIC_PART_OPTIONS.map((part) => (
              <option key={part} value={part}>
                {getToeicPartLabel(part)}
              </option>
            ))}
          </select>
        </div>
        <div className="field formGap">
          <label htmlFor="toeic-difficulty">難易度</label>
          <select
            className="select"
            id="toeic-difficulty"
            value={selectedDifficulty}
            onChange={(event) => setFilters(selectedPart, event.target.value as ToeicDifficulty | "all")}
          >
            <option value="all">すべて</option>
            {TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {getToeicDifficultyLabel(difficulty)}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">対象問題: {filteredQuestions.length}件</p>

        <section className="sectionGap">
          <h2 className="sectionTitle">TOEIC統計</h2>
          <div className="metricGrid">
            <div className="metricBox">
              <span className="metricLabel">累計回答数</span>
              <strong>{stats.totalCount}</strong>
            </div>
            <div className="metricBox">
              <span className="metricLabel">正解数</span>
              <strong>{stats.correctCount}</strong>
            </div>
            <div className="metricBox">
              <span className="metricLabel">正答率</span>
              <strong>{stats.accuracy}%</strong>
            </div>
          </div>
          <div className="chartList formGap">
            {stats.partStats
              .filter((item) => item.totalCount > 0)
              .map((item) => (
                <div className="chartRow" key={item.key}>
                  <span>{item.label}</span>
                  <div className="barTrack">
                    <div className="barFill" style={{ width: `${item.accuracy}%` }} />
                  </div>
                  <span>{item.accuracy}%</span>
                </div>
              ))}
            {stats.difficultyStats
              .filter((item) => item.totalCount > 0)
              .map((item) => (
                <div className="chartRow" key={item.key}>
                  <span>{item.label}</span>
                  <div className="barTrack">
                    <div className="barFill" style={{ width: `${item.accuracy}%` }} />
                  </div>
                  <span>{item.accuracy}%</span>
                </div>
              ))}
          </div>
        </section>
      </aside>

      <section className="panel">
        {questions.length === 0 ? (
          <div className="emptyState">TOEIC問題が登録されていません。</div>
        ) : currentQuestion && currentChoices ? (
          <>
            <p className="metaText">
              {getToeicPartLabel(currentQuestion.part)} / {getToeicDifficultyLabel(currentQuestion.difficulty)}
            </p>
            <div className="phraseBox">
              <p className="phraseCardText phraseCardJapanese">{currentQuestion.question_text}</p>
            </div>
            <div className="chartList formGap">
              {TOEIC_CHOICE_KEYS.map((choiceKey) => {
                const isSelected = answerResult?.selectedChoice === choiceKey;
                const isCorrectChoice = answerResult?.correctChoice === choiceKey;

                return (
                  <button
                    className={`button ${answerResult ? "buttonSecondary" : "buttonPrimaryAction"}`}
                    type="button"
                    key={choiceKey}
                    onClick={() => selectChoice(choiceKey)}
                    disabled={answerResult !== null || isSaving}
                  >
                    {choiceKey}. {currentChoices[choiceKey]}
                    {isSelected ? " / 選択" : ""}
                    {isCorrectChoice ? " / 正解" : ""}
                  </button>
                );
              })}
            </div>
            {message ? <p className="metaText">{message}</p> : null}
            {answerResult ? (
              <section className="answerBlock sectionGap" aria-live="polite">
                <p>
                  <strong>判定:</strong> {answerResult.isCorrect ? "正解" : "不正解"}
                </p>
                <p>
                  <strong>正解:</strong> {answerResult.correctChoice}
                </p>
                <p>
                  <strong>解説:</strong> {currentQuestion.explanation || "解説は登録されていません。"}
                </p>
                <button className="button buttonPrimaryAction formGap" type="button" onClick={moveNext}>
                  次の問題へ
                </button>
              </section>
            ) : null}
          </>
        ) : (
          <div className="emptyState">選択した条件に一致する有効な問題がありません。</div>
        )}
      </section>
    </div>
  );
}
