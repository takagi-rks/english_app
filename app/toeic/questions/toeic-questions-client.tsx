"use client";

import { useMemo, useState } from "react";
import {
  getToeicDifficultyLabel,
  getToeicPartLabel,
  getToeicQuestionKey,
  isToeicChoiceKey,
  parseToeicChoices,
  parseToeicTags,
  toeicChoicesToJson,
  TOEIC_CHOICE_KEYS,
  TOEIC_DIFFICULTY_OPTIONS,
  TOEIC_PART_OPTIONS,
} from "@/lib/toeic";
import {
  createSupabaseClient,
  type ToeicChoiceKey,
  type ToeicChoices,
  type ToeicDifficulty,
  type ToeicPart,
  type ToeicQuestion,
} from "@/lib/supabase";

type ToeicQuestionForm = {
  part: ToeicPart;
  difficulty: ToeicDifficulty;
  questionText: string;
  choices: ToeicChoices;
  correctChoice: ToeicChoiceKey;
  explanation: string;
  tagsInput: string;
};

type ToeicQuestionPayload = {
  part: ToeicPart;
  difficulty: ToeicDifficulty;
  question_text: string;
  choices: ReturnType<typeof toeicChoicesToJson>;
  correct_choice: ToeicChoiceKey;
  explanation: string | null;
  tags: string[];
};

type ToeicQuestionsClientProps = {
  initialQuestions: ToeicQuestion[];
  initialErrorMessage: string | null;
};

const emptyForm: ToeicQuestionForm = {
  part: "part5",
  difficulty: "beginner",
  questionText: "",
  choices: {
    A: "",
    B: "",
    C: "",
    D: "",
  },
  correctChoice: "A",
  explanation: "",
  tagsInput: "",
};

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toForm(question: ToeicQuestion): ToeicQuestionForm {
  const choices = parseToeicChoices(question.choices) ?? emptyForm.choices;

  return {
    part: question.part,
    difficulty: question.difficulty,
    questionText: question.question_text,
    choices,
    correctChoice: question.correct_choice,
    explanation: question.explanation ?? "",
    tagsInput: question.tags.join(","),
  };
}

function validateForm(form: ToeicQuestionForm): string | null {
  if (!form.questionText.trim()) {
    return "問題文を入力してください。";
  }

  const emptyChoice = TOEIC_CHOICE_KEYS.find((key) => !form.choices[key].trim());

  if (emptyChoice) {
    return `選択肢${emptyChoice}を入力してください。`;
  }

  if (!isToeicChoiceKey(form.correctChoice)) {
    return "正解選択肢を選択してください。";
  }

  return null;
}

export function ToeicQuestionsClient({
  initialQuestions,
  initialErrorMessage,
}: ToeicQuestionsClientProps) {
  const [questions, setQuestions] = useState<ToeicQuestion[]>(initialQuestions);
  const [form, setForm] = useState<ToeicQuestionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPart, setFilterPart] = useState<ToeicPart | "all">("all");
  const [filterDifficulty, setFilterDifficulty] = useState<ToeicDifficulty | "all">("all");
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);

  const filteredQuestions = useMemo(
    () =>
      questions
        .filter((question) => filterPart === "all" || question.part === filterPart)
        .filter((question) => filterDifficulty === "all" || question.difficulty === filterDifficulty)
        .sort((a, b) => {
          const partCompare = a.part.localeCompare(b.part);

          if (partCompare !== 0) {
            return partCompare;
          }

          return a.question_text.localeCompare(b.question_text);
        }),
    [filterDifficulty, filterPart, questions],
  );

  async function refreshQuestions(successMessage: string) {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("toeic_questions")
      .select("id, part, question_text, choices, correct_choice, explanation, difficulty, tags, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`TOEIC問題一覧の再取得に失敗しました: ${error.message}`);
      return;
    }

    setQuestions(data);
    setMessage(successMessage);
  }

  function buildPayload(): ToeicQuestionPayload {
    return {
      part: form.part,
      difficulty: form.difficulty,
      question_text: form.questionText.trim(),
      choices: toeicChoicesToJson({
        A: form.choices.A.trim(),
        B: form.choices.B.trim(),
        C: form.choices.C.trim(),
        D: form.choices.D.trim(),
      }),
      correct_choice: form.correctChoice,
      explanation: form.explanation.trim() || null,
      tags: parseToeicTags(form.tagsInput),
    };
  }

  async function submitQuestion() {
    const validationError = validateForm(form);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const payload = buildPayload();
    const duplicateQuestion = questions.find(
      (question) => question.id !== editingId && getToeicQuestionKey(question) === getToeicQuestionKey(payload),
    );

    if (duplicateQuestion) {
      setMessage("同じTOEIC問題が既に登録されています。");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();

      if (editingId) {
        const { error } = await supabase.from("toeic_questions").update(payload).eq("id", editingId);

        if (error) {
          setMessage(`TOEIC問題の更新に失敗しました: ${error.message}`);
          return;
        }

        setEditingId(null);
        setForm(emptyForm);
        await refreshQuestions("TOEIC問題を更新しました。");
        return;
      }

      const { error } = await supabase.from("toeic_questions").insert(payload);

      if (error) {
        setMessage(`TOEIC問題の追加に失敗しました: ${error.message}`);
        return;
      }

      setForm(emptyForm);
      await refreshQuestions("TOEIC問題を追加しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`TOEIC問題の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteQuestion(question: ToeicQuestion) {
    const shouldDelete = window.confirm("このTOEIC問題を削除しますか？");

    if (!shouldDelete) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("toeic_questions").delete().eq("id", question.id);

      if (error) {
        setMessage(`TOEIC問題の削除に失敗しました: ${error.message}`);
        return;
      }

      if (editingId === question.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await refreshQuestions("TOEIC問題を削除しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`TOEIC問題の削除に失敗しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  function startEditing(question: ToeicQuestion) {
    setEditingId(question.id);
    setForm(toForm(question));
    setMessage("編集内容を入力して更新してください。");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  }

  return (
    <div className="gridTwo">
      <section className="panel" aria-label="TOEIC問題フォーム">
        <div className="field">
          <label htmlFor="toeic-question-part">Part</label>
          <select
            className="select"
            id="toeic-question-part"
            value={form.part}
            onChange={(event) =>
              setForm((current) => ({ ...current, part: event.target.value as ToeicPart }))
            }
          >
            {TOEIC_PART_OPTIONS.map((part) => (
              <option key={part} value={part}>
                {getToeicPartLabel(part)}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="toeic-question-difficulty">難易度</label>
          <select
            className="select"
            id="toeic-question-difficulty"
            value={form.difficulty}
            onChange={(event) =>
              setForm((current) => ({ ...current, difficulty: event.target.value as ToeicDifficulty }))
            }
          >
            {TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {getToeicDifficultyLabel(difficulty)}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="toeic-question-text">問題文</label>
          <textarea
            className="textarea"
            id="toeic-question-text"
            value={form.questionText}
            onChange={(event) => setForm((current) => ({ ...current, questionText: event.target.value }))}
          />
        </div>

        {TOEIC_CHOICE_KEYS.map((choiceKey) => (
          <div className="field formGap" key={choiceKey}>
            <label htmlFor={`toeic-choice-${choiceKey}`}>選択肢{choiceKey}</label>
            <input
              className="input"
              id={`toeic-choice-${choiceKey}`}
              value={form.choices[choiceKey]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  choices: {
                    ...current.choices,
                    [choiceKey]: event.target.value,
                  },
                }))
              }
            />
          </div>
        ))}

        <div className="field formGap">
          <label htmlFor="toeic-correct-choice">正解</label>
          <select
            className="select"
            id="toeic-correct-choice"
            value={form.correctChoice}
            onChange={(event) =>
              setForm((current) => ({ ...current, correctChoice: event.target.value as ToeicChoiceKey }))
            }
          >
            {TOEIC_CHOICE_KEYS.map((choiceKey) => (
              <option key={choiceKey} value={choiceKey}>
                {choiceKey}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="toeic-explanation">解説</label>
          <textarea
            className="textarea"
            id="toeic-explanation"
            value={form.explanation}
            onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))}
          />
        </div>

        <div className="field formGap">
          <label htmlFor="toeic-tags">タグ</label>
          <input
            className="input"
            id="toeic-tags"
            value={form.tagsInput}
            onChange={(event) => setForm((current) => ({ ...current, tagsInput: event.target.value }))}
            placeholder="grammar,email,vocabulary"
          />
        </div>

        <div className="buttonRow formGap">
          <button className="button buttonPrimaryAction" type="button" onClick={submitQuestion} disabled={isLoading}>
            {editingId ? "更新する" : "追加する"}
          </button>
          {editingId ? (
            <button className="button buttonSecondary" type="button" onClick={cancelEditing} disabled={isLoading}>
              キャンセル
            </button>
          ) : null}
        </div>

        {message ? <p className="metaText">{message}</p> : null}
      </section>

      <section className="panel" aria-label="TOEIC問題一覧">
        <div className="filterGrid">
          <div className="field">
            <label htmlFor="toeic-filter-part">Part</label>
            <select
              className="select"
              id="toeic-filter-part"
              value={filterPart}
              onChange={(event) => setFilterPart(event.target.value as ToeicPart | "all")}
            >
              <option value="all">すべて</option>
              {TOEIC_PART_OPTIONS.map((part) => (
                <option key={part} value={part}>
                  {getToeicPartLabel(part)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="toeic-filter-difficulty">難易度</label>
            <select
              className="select"
              id="toeic-filter-difficulty"
              value={filterDifficulty}
              onChange={(event) => setFilterDifficulty(event.target.value as ToeicDifficulty | "all")}
            >
              <option value="all">すべて</option>
              {TOEIC_DIFFICULTY_OPTIONS.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {getToeicDifficultyLabel(difficulty)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="metaText">
          表示件数: {filteredQuestions.length} / 登録件数: {questions.length}
        </p>

        {initialErrorMessage ? <div className="errorMessage">{initialErrorMessage}</div> : null}

        {filteredQuestions.length === 0 ? (
          <div className="emptyState">TOEIC問題が登録されていません。</div>
        ) : (
          <div className="phraseCardGrid">
            {filteredQuestions.map((question) => {
              const choices = parseToeicChoices(question.choices);

              return (
                <article className="phraseCard" key={question.id}>
                  <div className="phraseCardMeta">
                    <span>{getToeicPartLabel(question.part)}</span>
                    <span>{getToeicDifficultyLabel(question.difficulty)}</span>
                    <span>正解: {question.correct_choice}</span>
                  </div>
                  <div className="phraseCardBody">
                    <div>
                      <span className="phraseCardLabel">問題文</span>
                      <p className="phraseCardText phraseCardJapanese">{question.question_text}</p>
                    </div>
                    <div>
                      <span className="phraseCardLabel">選択肢</span>
                      {choices ? (
                        <div className="answerBlock">
                          {TOEIC_CHOICE_KEYS.map((choiceKey) => (
                            <p key={choiceKey}>
                              <strong>{choiceKey}:</strong> {choices[choiceKey]}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="phraseCardText">選択肢の形式が不正です。</p>
                      )}
                    </div>
                    <div>
                      <span className="phraseCardLabel">解説</span>
                      <p className="phraseCardText">{question.explanation || "なし"}</p>
                    </div>
                    <div>
                      <span className="phraseCardLabel">タグ</span>
                      {question.tags.length > 0 ? (
                        <div className="tagList">
                          {question.tags.map((tag) => (
                            <span className="tagPill" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="phraseCardText">なし</p>
                      )}
                    </div>
                  </div>
                  <div className="phraseCardFooter">
                    <span className="metaText">作成日時: {formatDate(question.created_at)}</span>
                    <div className="buttonRow compactActions">
                      <button
                        className="button buttonSecondary buttonSmall"
                        type="button"
                        onClick={() => startEditing(question)}
                        disabled={isLoading}
                      >
                        編集
                      </button>
                      <button
                        className="button buttonDanger buttonSmall"
                        type="button"
                        onClick={() => deleteQuestion(question)}
                        disabled={isLoading}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
