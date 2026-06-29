"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  getToeicDifficultyLabel,
  getToeicPartLabel,
  getToeicQuestionKey,
  isToeicChoiceKey,
  isToeicDifficulty,
  isToeicPart,
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

type CsvPreviewRow = {
  rowNumber: number;
  payload: ToeicQuestionPayload;
  status: "ready" | "skip" | "error";
  message: string;
};

type ImportResult = {
  successCount: number;
  skipCount: number;
  errorCount: number;
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
    tagsInput: question.tags.join("|"),
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

function getCsvImportErrorMessage(error: { message: string }): string {
  if (error.message.toLowerCase().includes("row-level security")) {
    return "CSVインポートに失敗しました: Supabaseの行レベルセキュリティ設定により登録できません。";
  }

  return `CSVインポートに失敗しました: ${error.message}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  const normalizedText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(current.trim());

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      current = "";
      continue;
    }

    current += character;
  }

  row.push(current.trim());

  if (inQuotes) {
    throw new Error("CSVの引用符が閉じられていません。");
  }

  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
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
  const [csvRows, setCsvRows] = useState<CsvPreviewRow[]>([]);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  function buildCsvPreview(rows: string[][]): CsvPreviewRow[] {
    const [headers, ...bodyRows] = rows;

    if (!headers) {
      throw new Error("CSVにヘッダー行がありません。");
    }

    const normalizedHeaders = headers.map((header) => header.trim());
    const requiredHeaders = [
      "part",
      "difficulty",
      "question_text",
      "choice_a",
      "choice_b",
      "choice_c",
      "choice_d",
      "correct_choice",
    ];
    const missingHeaders = requiredHeaders.filter((header) => !normalizedHeaders.includes(header));

    if (missingHeaders.length > 0) {
      throw new Error(`CSVに必須列がありません: ${missingHeaders.join(", ")}`);
    }

    const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));
    const existingKeys = new Set(questions.map((question) => getToeicQuestionKey(question)));
    const csvKeys = new Set<string>();

    return bodyRows.map((row, index): CsvPreviewRow => {
      const getValue = (header: string): string => {
        const columnIndex = headerIndex.get(header);
        return columnIndex === undefined ? "" : row[columnIndex]?.trim() ?? "";
      };
      const rowNumber = index + 2;
      const part = getValue("part");
      const difficulty = getValue("difficulty") || "beginner";
      const correctChoice = getValue("correct_choice").toUpperCase();
      const payload: ToeicQuestionPayload = {
        part: isToeicPart(part) ? part : "part5",
        difficulty: isToeicDifficulty(difficulty) ? difficulty : "beginner",
        question_text: getValue("question_text"),
        choices: toeicChoicesToJson({
          A: getValue("choice_a"),
          B: getValue("choice_b"),
          C: getValue("choice_c"),
          D: getValue("choice_d"),
        }),
        correct_choice: isToeicChoiceKey(correctChoice) ? correctChoice : "A",
        explanation: getValue("explanation") || null,
        tags: parseToeicTags(getValue("tags")),
      };

      if (!part || !difficulty || !payload.question_text || !correctChoice) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "必須項目が不足しています。",
        };
      }

      if (!isToeicPart(part)) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "partの値が不正です。",
        };
      }

      if (!isToeicDifficulty(difficulty)) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "difficultyの値が不正です。",
        };
      }

      if (!isToeicChoiceKey(correctChoice)) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "correct_choiceの値が不正です。",
        };
      }

      const choices = parseToeicChoices(payload.choices);

      if (!choices) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "choice_a〜choice_dをすべて入力してください。",
        };
      }

      const key = getToeicQuestionKey(payload);

      if (existingKeys.has(key) || csvKeys.has(key)) {
        csvKeys.add(key);
        return {
          rowNumber,
          payload,
          status: "skip",
          message: "同じTOEIC問題が既に登録されています。",
        };
      }

      csvKeys.add(key);
      return {
        rowNumber,
        payload,
        status: "ready",
        message: "登録予定",
      };
    });
  }

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportResult(null);

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const previewRows = buildCsvPreview(rows);
      setCsvRows(previewRows);
      setCsvMessage(`CSVを読み込みました。${previewRows.length}件をプレビューしています。`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "CSVの読み込みに失敗しました。";
      setCsvRows([]);
      setCsvMessage(errorMessage);
    }
  }

  async function importCsvRows() {
    const readyRows = csvRows.filter((row) => row.status === "ready");
    const skipCount = csvRows.filter((row) => row.status === "skip").length;
    const validationErrorCount = csvRows.filter((row) => row.status === "error").length;

    if (readyRows.length === 0) {
      setImportResult({
        successCount: 0,
        skipCount,
        errorCount: validationErrorCount,
      });
      setCsvMessage("登録できる行がありません。");
      return;
    }

    setIsImporting(true);
    setCsvMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("toeic_questions")
        .insert(readyRows.map((row) => row.payload))
        .select("id");

      if (error) {
        setImportResult({
          successCount: 0,
          skipCount,
          errorCount: validationErrorCount + readyRows.length,
        });
        setCsvMessage(getCsvImportErrorMessage(error));
        return;
      }

      const successCount = data.length;
      setImportResult({
        successCount,
        skipCount,
        errorCount: validationErrorCount + Math.max(0, readyRows.length - successCount),
      });
      setCsvRows([]);
      await refreshQuestions("CSVインポートが完了しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setImportResult({
        successCount: 0,
        skipCount,
        errorCount: validationErrorCount + readyRows.length,
      });
      setCsvMessage(`CSVインポートに失敗しました: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
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
            placeholder="grammar|email|vocabulary"
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

      <section className="panel" aria-label="TOEIC CSVインポート">
        <h2 className="sectionTitle">CSVインポート</h2>
        <div className="field">
          <label htmlFor="toeic-csv-file">CSVファイル</label>
          <input
            className="input"
            id="toeic-csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileChange}
          />
        </div>
        <p className="metaText">
          形式: part, question_text, choice_a, choice_b, choice_c, choice_d, correct_choice,
          explanation, difficulty, tags（tagsは|区切り）
        </p>
        {csvMessage ? <p className="metaText">{csvMessage}</p> : null}
        {importResult ? (
          <p className="metaText">
            成功: {importResult.successCount} / スキップ: {importResult.skipCount} / 失敗:{" "}
            {importResult.errorCount}
          </p>
        ) : null}
        {csvRows.length > 0 ? (
          <>
            <div className="buttonRow formGap">
              <button
                className="button buttonPrimaryAction"
                type="button"
                onClick={importCsvRows}
                disabled={isImporting || csvRows.every((row) => row.status !== "ready")}
              >
                {isImporting ? "インポート中" : "インポート実行"}
              </button>
              <button
                className="button buttonSecondary"
                type="button"
                onClick={() => {
                  setCsvRows([]);
                  setCsvMessage(null);
                  setImportResult(null);
                }}
                disabled={isImporting}
              >
                クリア
              </button>
            </div>
            <div className="tableWrap formGap">
              <table className="historyTable">
                <thead>
                  <tr>
                    <th>行</th>
                    <th>状態</th>
                    <th>Part</th>
                    <th>難易度</th>
                    <th>問題文</th>
                    <th>正解</th>
                    <th>タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.message}</td>
                      <td>{getToeicPartLabel(row.payload.part)}</td>
                      <td>{getToeicDifficultyLabel(row.payload.difficulty)}</td>
                      <td>{row.payload.question_text}</td>
                      <td>{row.payload.correct_choice}</td>
                      <td>{row.payload.tags.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvRows.length > 50 ? (
              <p className="metaText">プレビューは先頭50件のみ表示しています。</p>
            ) : null}
          </>
        ) : null}
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
