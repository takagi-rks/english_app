"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  getLevelLabel,
  getPronunciationDifficultyLabel,
  getSceneLabel,
  LEVEL_OPTIONS,
  PRONUNCIATION_DIFFICULTY_OPTIONS,
  SCENE_OPTIONS,
} from "@/lib/constants";
import {
  createSupabaseClient,
  type Phrase,
  type PhraseLevel,
  type PronunciationDifficulty,
} from "@/lib/supabase";

type PhraseForm = {
  scene: string;
  japanese: string;
  english: string;
  hint: string;
  level: PhraseLevel;
  pronunciation_difficulty: PronunciationDifficulty;
  grammarTagsInput: string;
};

type PhrasePayload = {
  scene: string;
  japanese: string;
  english: string;
  hint: string;
  level: PhraseLevel;
  pronunciation_difficulty: PronunciationDifficulty;
  grammar_tags: string[];
};

type CsvPreviewRow = {
  rowNumber: number;
  payload: PhrasePayload;
  status: "ready" | "skip" | "error";
  message: string;
};

type ImportResult = {
  successCount: number;
  skipCount: number;
  failureCount: number;
};

type PhrasesClientProps = {
  initialPhrases: Phrase[];
  initialErrorMessage: string | null;
};

const emptyForm: PhraseForm = {
  scene: "greeting",
  japanese: "",
  english: "",
  hint: "",
  level: "beginner",
  pronunciation_difficulty: "easy",
  grammarTagsInput: "",
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

function toForm(phrase: Phrase): PhraseForm {
  return {
    scene: phrase.scene,
    japanese: phrase.japanese,
    english: phrase.english,
    hint: phrase.hint,
    level: phrase.level,
    pronunciation_difficulty: phrase.pronunciation_difficulty,
    grammarTagsInput: phrase.grammar_tags.join(","),
  };
}

function validateForm(form: PhraseForm): string | null {
  if (!form.scene.trim()) {
    return "シーンを選択してください。";
  }

  if (!form.japanese.trim()) {
    return "日本語フレーズを入力してください。";
  }

  if (!form.english.trim()) {
    return "正解英文を入力してください。";
  }

  if (!LEVEL_OPTIONS.includes(form.level)) {
    return "レベルを選択してください。";
  }

  if (!PRONUNCIATION_DIFFICULTY_OPTIONS.includes(form.pronunciation_difficulty)) {
    return "発音難易度を選択してください。";
  }

  return null;
}

function parseGrammarTags(value: string, separator: "," | "|"): string[] {
  return value
    .split(separator)
    .map((tag) => tag.trim())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
}

function getPhraseKey(value: Pick<PhrasePayload, "scene" | "japanese" | "english" | "level">): string {
  return [value.scene, value.japanese.trim(), value.english.trim(), value.level].join("\u0000");
}

function isSamePhrase(phrase: Phrase, form: PhrasePayload): boolean {
  return (
    phrase.scene === form.scene &&
    phrase.japanese.trim() === form.japanese.trim() &&
    phrase.english.trim() === form.english.trim() &&
    phrase.level === form.level
  );
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

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
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function isPhraseLevel(value: string): value is PhraseLevel {
  return LEVEL_OPTIONS.includes(value as PhraseLevel);
}

function isPronunciationDifficulty(value: string): value is PronunciationDifficulty {
  return PRONUNCIATION_DIFFICULTY_OPTIONS.includes(value as PronunciationDifficulty);
}

export function PhrasesClient({ initialPhrases, initialErrorMessage }: PhrasesClientProps) {
  const [phrases, setPhrases] = useState<Phrase[]>(initialPhrases);
  const [form, setForm] = useState<PhraseForm>(emptyForm);
  const [filterScene, setFilterScene] = useState("all");
  const [filterLevel, setFilterLevel] = useState<"all" | PhraseLevel>("all");
  const [filterPronunciationDifficulty, setFilterPronunciationDifficulty] = useState<
    "all" | PronunciationDifficulty
  >("all");
  const [keyword, setKeyword] = useState("");
  const [csvRows, setCsvRows] = useState<CsvPreviewRow[]>([]);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const filteredPhrases = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return phrases
      .filter((phrase) => filterScene === "all" || phrase.scene === filterScene)
      .filter((phrase) => filterLevel === "all" || phrase.level === filterLevel)
      .filter(
        (phrase) =>
          filterPronunciationDifficulty === "all" ||
          phrase.pronunciation_difficulty === filterPronunciationDifficulty,
      )
      .filter((phrase) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [phrase.japanese, phrase.english, phrase.hint, phrase.grammar_tags.join(" ")].some(
          (value) => value.toLowerCase().includes(normalizedKeyword),
        );
      })
      .sort((a, b) => {
        const sceneCompare = a.scene.localeCompare(b.scene, "ja");
        if (sceneCompare !== 0) {
          return sceneCompare;
        }

        return a.japanese.localeCompare(b.japanese, "ja");
      });
  }, [filterLevel, filterPronunciationDifficulty, filterScene, keyword, phrases]);

  function getSupabaseErrorMessage(error: { code?: string; message: string }, action: string): string {
    if (error.code === "23505") {
      return "同じ教材が既に登録されています。";
    }

    return `教材の${action}に失敗しました: ${error.message}`;
  }

  async function refreshPhrases(successMessage: string) {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_phrases")
      .select(
        "id, scene, japanese, english, hint, level, pronunciation_difficulty, grammar_tags, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`一覧の再取得に失敗しました: ${error.message}`);
      return;
    }

    setPhrases(data);
    setMessage(successMessage);
  }

  function buildCsvPreview(rows: string[][]): CsvPreviewRow[] {
    const [headers, ...bodyRows] = rows;

    if (!headers) {
      throw new Error("CSVにヘッダー行がありません。");
    }

    const normalizedHeaders = headers.map((header) => header.trim());
    const requiredHeaders = ["scene", "japanese", "english", "level"];
    const missingHeaders = requiredHeaders.filter((header) => !normalizedHeaders.includes(header));

    if (missingHeaders.length > 0) {
      throw new Error(`CSVに必須列がありません: ${missingHeaders.join(", ")}`);
    }

    const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));
    const existingKeys = new Set(phrases.map((phrase) => getPhraseKey(phrase)));
    const csvKeys = new Set<string>();

    return bodyRows.map((row, index): CsvPreviewRow => {
      const getValue = (header: string): string => {
        const columnIndex = headerIndex.get(header);
        return columnIndex === undefined ? "" : row[columnIndex]?.trim() ?? "";
      };

      const scene = getValue("scene");
      const japanese = getValue("japanese");
      const english = getValue("english");
      const level = getValue("level");
      const pronunciationValue = getValue("pronunciation_difficulty") || "easy";
      const payload: PhrasePayload = {
        scene,
        japanese,
        english,
        hint: getValue("hint"),
        level: isPhraseLevel(level) ? level : "beginner",
        pronunciation_difficulty: isPronunciationDifficulty(pronunciationValue)
          ? pronunciationValue
          : "easy",
        grammar_tags: parseGrammarTags(getValue("grammar_tags"), "|"),
      };
      const rowNumber = index + 2;

      if (!scene || !japanese || !english || !level) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "必須項目が不足しています。",
        };
      }

      if (!isPhraseLevel(level)) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "levelの値が不正です。",
        };
      }

      if (!isPronunciationDifficulty(pronunciationValue)) {
        return {
          rowNumber,
          payload,
          status: "error",
          message: "pronunciation_difficultyの値が不正です。",
        };
      }

      const key = getPhraseKey(payload);

      if (existingKeys.has(key) || csvKeys.has(key)) {
        csvKeys.add(key);
        return {
          rowNumber,
          payload,
          status: "skip",
          message: "同じ教材が既に登録されています。",
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
    const validationFailureCount = csvRows.filter((row) => row.status === "error").length;

    if (readyRows.length === 0) {
      setImportResult({
        successCount: 0,
        skipCount,
        failureCount: validationFailureCount,
      });
      setCsvMessage("登録できる行がありません。");
      return;
    }

    setIsImporting(true);
    setCsvMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase
        .from("english_phrases")
        .insert(readyRows.map((row) => row.payload))
        .select("id");

      if (error) {
        setImportResult({
          successCount: 0,
          skipCount,
          failureCount: validationFailureCount + readyRows.length,
        });
        setCsvMessage(`CSVインポートに失敗しました: ${error.message}`);
        return;
      }

      const successCount = data.length;
      setImportResult({
        successCount,
        skipCount,
        failureCount: validationFailureCount + Math.max(0, readyRows.length - successCount),
      });
      setCsvRows([]);
      await refreshPhrases("CSVインポートが完了しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setImportResult({
        successCount: 0,
        skipCount,
        failureCount: validationFailureCount + readyRows.length,
      });
      setCsvMessage(`CSVインポートに失敗しました: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  }

  async function submitPhrase() {
    const validationError = validateForm(form);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const payload: PhrasePayload = {
      scene: form.scene,
      japanese: form.japanese.trim(),
      english: form.english.trim(),
      hint: form.hint.trim(),
      level: form.level,
      pronunciation_difficulty: form.pronunciation_difficulty,
      grammar_tags: parseGrammarTags(form.grammarTagsInput, ","),
    };

    const duplicatePhrase = phrases.find(
      (phrase) => phrase.id !== editingId && isSamePhrase(phrase, payload),
    );

    if (duplicatePhrase) {
      setMessage("同じ教材が既に登録されています。");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();

      if (editingId) {
        const { error } = await supabase.from("english_phrases").update(payload).eq("id", editingId);

        if (error) {
          setMessage(getSupabaseErrorMessage(error, "更新"));
          return;
        }

        setForm(emptyForm);
        setEditingId(null);
        await refreshPhrases("教材を更新しました。");
        return;
      }

      const { error } = await supabase.from("english_phrases").insert(payload);

      if (error) {
        setMessage(getSupabaseErrorMessage(error, "追加"));
        return;
      }

      setForm(emptyForm);
      await refreshPhrases("教材を追加しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`教材の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function deletePhrase(phrase: Phrase) {
    const shouldDelete = window.confirm(`「${phrase.japanese}」を削除しますか？`);

    if (!shouldDelete) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("english_phrases").delete().eq("id", phrase.id);

      if (error) {
        setMessage(`教材の削除に失敗しました: ${error.message}`);
        return;
      }

      if (editingId === phrase.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await refreshPhrases("教材を削除しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`教材の削除に失敗しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }

  function startEditing(phrase: Phrase) {
    setEditingId(phrase.id);
    setForm(toForm(phrase));
    setMessage("編集内容を入力して更新してください。");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
  }

  return (
    <div className="gridTwo">
      <section className="panel" aria-label="教材フォーム">
        <div className="field">
          <label htmlFor="scene">シーン</label>
          <select
            className="select"
            id="scene"
            value={form.scene}
            onChange={(event) => setForm((current) => ({ ...current, scene: event.target.value }))}
          >
            {SCENE_OPTIONS.map((scene) => (
              <option key={scene} value={scene}>
                {getSceneLabel(scene)}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="level">レベル</label>
          <select
            className="select"
            id="level"
            value={form.level}
            onChange={(event) =>
              setForm((current) => ({ ...current, level: event.target.value as PhraseLevel }))
            }
          >
            {LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {getLevelLabel(level)}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="pronunciation-difficulty">発音難易度</label>
          <select
            className="select"
            id="pronunciation-difficulty"
            value={form.pronunciation_difficulty}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                pronunciation_difficulty: event.target.value as PronunciationDifficulty,
              }))
            }
          >
            {PRONUNCIATION_DIFFICULTY_OPTIONS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {getPronunciationDifficultyLabel(difficulty)}
              </option>
            ))}
          </select>
        </div>

        <div className="field formGap">
          <label htmlFor="japanese">日本語フレーズ</label>
          <textarea
            className="textarea"
            id="japanese"
            value={form.japanese}
            onChange={(event) =>
              setForm((current) => ({ ...current, japanese: event.target.value }))
            }
          />
        </div>

        <div className="field formGap">
          <label htmlFor="english">正解英文</label>
          <textarea
            className="textarea"
            id="english"
            value={form.english}
            onChange={(event) =>
              setForm((current) => ({ ...current, english: event.target.value }))
            }
          />
        </div>

        <div className="field formGap">
          <label htmlFor="hint">ヒント</label>
          <textarea
            className="textarea"
            id="hint"
            value={form.hint}
            onChange={(event) => setForm((current) => ({ ...current, hint: event.target.value }))}
          />
        </div>

        <div className="field formGap">
          <label htmlFor="grammar-tags">文法タグ</label>
          <input
            className="input"
            id="grammar-tags"
            value={form.grammarTagsInput}
            onChange={(event) =>
              setForm((current) => ({ ...current, grammarTagsInput: event.target.value }))
            }
            placeholder="present-simple,question,ordering"
          />
        </div>

        <div className="buttonRow formGap">
          <button className="button" type="button" onClick={submitPhrase} disabled={isLoading}>
            {editingId ? "更新する" : "追加する"}
          </button>
          {editingId ? (
            <button
              className="button buttonSecondary"
              type="button"
              onClick={cancelEditing}
              disabled={isLoading}
            >
              キャンセル
            </button>
          ) : null}
        </div>

        {message ? <p className="metaText">{message}</p> : null}
      </section>

      <section className="panel" aria-label="CSVインポート">
        <h2 className="sectionTitle">CSVインポート</h2>
        <div className="field">
          <label htmlFor="csv-file">CSVファイル</label>
          <input
            className="input"
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileChange}
          />
        </div>
        <p className="metaText">
          必須列: scene, japanese, english, level / 任意列: hint, pronunciation_difficulty,
          grammar_tags
        </p>
        {csvMessage ? <p className="metaText">{csvMessage}</p> : null}
        {importResult ? (
          <p className="metaText">
            成功: {importResult.successCount} / スキップ: {importResult.skipCount} / 失敗:{" "}
            {importResult.failureCount}
          </p>
        ) : null}
        {csvRows.length > 0 ? (
          <>
            <div className="buttonRow formGap">
              <button
                className="button"
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
                    <th>シーン</th>
                    <th>レベル</th>
                    <th>日本語</th>
                    <th>英語</th>
                    <th>発音</th>
                    <th>文法タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.message}</td>
                      <td>{getSceneLabel(row.payload.scene)}</td>
                      <td>{getLevelLabel(row.payload.level)}</td>
                      <td>{row.payload.japanese}</td>
                      <td>{row.payload.english}</td>
                      <td>{getPronunciationDifficultyLabel(row.payload.pronunciation_difficulty)}</td>
                      <td>{row.payload.grammar_tags.join(", ")}</td>
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

      <section className="panel" aria-label="教材一覧">
        <div className="filterGrid">
          <div className="field">
            <label htmlFor="filter-scene">シーンで絞り込み</label>
            <select
              className="select"
              id="filter-scene"
              value={filterScene}
              onChange={(event) => setFilterScene(event.target.value)}
            >
              <option value="all">すべて</option>
              {SCENE_OPTIONS.map((scene) => (
                <option key={scene} value={scene}>
                  {getSceneLabel(scene)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-level">レベルで絞り込み</label>
            <select
              className="select"
              id="filter-level"
              value={filterLevel}
              onChange={(event) => setFilterLevel(event.target.value as "all" | PhraseLevel)}
            >
              <option value="all">すべて</option>
              {LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {getLevelLabel(level)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="keyword">キーワード検索</label>
            <input
              className="input"
              id="keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="日本語 / 英語 / ヒント"
            />
          </div>
          <div className="field">
            <label htmlFor="filter-pronunciation">発音難易度</label>
            <select
              className="select"
              id="filter-pronunciation"
              value={filterPronunciationDifficulty}
              onChange={(event) =>
                setFilterPronunciationDifficulty(event.target.value as "all" | PronunciationDifficulty)
              }
            >
              <option value="all">すべて</option>
              {PRONUNCIATION_DIFFICULTY_OPTIONS.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {getPronunciationDifficultyLabel(difficulty)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="metaText">
          表示件数: {filteredPhrases.length} / 登録件数: {phrases.length}
        </p>

        {filteredPhrases.length === 0 ? (
          <div className="emptyState">条件に一致する教材がありません。</div>
        ) : (
          <div className="phraseCardGrid">
            {filteredPhrases.map((phrase) => (
              <article className="phraseCard" key={phrase.id}>
                <div className="phraseCardMeta">
                  <span>{getSceneLabel(phrase.scene)}</span>
                  <span>{getLevelLabel(phrase.level)}</span>
                  <span>{getPronunciationDifficultyLabel(phrase.pronunciation_difficulty)}</span>
                </div>

                <div className="phraseCardBody">
                  <div>
                    <span className="phraseCardLabel">日本語</span>
                    <p className="phraseCardText phraseCardJapanese">{phrase.japanese}</p>
                  </div>
                  <div>
                    <span className="phraseCardLabel">英語</span>
                    <p className="phraseCardText">{phrase.english}</p>
                  </div>
                  <div>
                    <span className="phraseCardLabel">ヒント</span>
                    <p className="phraseCardText">{phrase.hint || "なし"}</p>
                  </div>
                  <div>
                    <span className="phraseCardLabel">文法タグ</span>
                    {phrase.grammar_tags.length > 0 ? (
                      <div className="tagList">
                        {phrase.grammar_tags.map((tag) => (
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
                  <span className="metaText">作成日時: {formatDate(phrase.created_at)}</span>
                  <div className="buttonRow compactActions">
                    <button
                      className="button buttonSecondary buttonSmall"
                      type="button"
                      onClick={() => startEditing(phrase)}
                      disabled={isLoading}
                    >
                      編集
                    </button>
                    <button
                      className="button buttonDanger buttonSmall"
                      type="button"
                      onClick={() => deletePhrase(phrase)}
                      disabled={isLoading}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
