"use client";

import { useMemo, useState } from "react";
import { createSupabaseClient, type Phrase, type PhraseLevel } from "@/lib/supabase";

type PhraseForm = {
  scene: string;
  japanese: string;
  english: string;
  hint: string;
  level: PhraseLevel;
};

type PhrasesClientProps = {
  initialPhrases: Phrase[];
  initialErrorMessage: string | null;
};

const sceneOptions = ["greeting", "cafe", "shopping", "directions", "smalltalk"] as const;
const levelOptions: PhraseLevel[] = ["beginner", "intermediate", "advanced"];

const emptyForm: PhraseForm = {
  scene: "greeting",
  japanese: "",
  english: "",
  hint: "",
  level: "beginner",
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

  if (!levelOptions.includes(form.level)) {
    return "レベルを選択してください。";
  }

  return null;
}

function isSamePhrase(phrase: Phrase, form: PhraseForm): boolean {
  return (
    phrase.scene === form.scene &&
    phrase.japanese.trim() === form.japanese.trim() &&
    phrase.english.trim() === form.english.trim() &&
    phrase.level === form.level
  );
}

export function PhrasesClient({ initialPhrases, initialErrorMessage }: PhrasesClientProps) {
  const [phrases, setPhrases] = useState<Phrase[]>(initialPhrases);
  const [form, setForm] = useState<PhraseForm>(emptyForm);
  const [filterScene, setFilterScene] = useState("all");
  const [filterLevel, setFilterLevel] = useState<"all" | PhraseLevel>("all");
  const [keyword, setKeyword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);

  const filteredPhrases = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return phrases
      .filter((phrase) => filterScene === "all" || phrase.scene === filterScene)
      .filter((phrase) => filterLevel === "all" || phrase.level === filterLevel)
      .filter((phrase) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [phrase.japanese, phrase.english, phrase.hint].some((value) =>
          value.toLowerCase().includes(normalizedKeyword),
        );
      })
      .sort((a, b) => {
        const sceneCompare = a.scene.localeCompare(b.scene, "ja");
        if (sceneCompare !== 0) {
          return sceneCompare;
        }

        return a.japanese.localeCompare(b.japanese, "ja");
      });
  }, [filterLevel, filterScene, keyword, phrases]);

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
      .select("id, scene, japanese, english, hint, level, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`一覧の再取得に失敗しました: ${error.message}`);
      return;
    }

    setPhrases(data);
    setMessage(successMessage);
  }

  async function submitPhrase() {
    const validationError = validateForm(form);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const payload: PhraseForm = {
      scene: form.scene,
      japanese: form.japanese.trim(),
      english: form.english.trim(),
      hint: form.hint.trim(),
      level: form.level,
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
            {sceneOptions.map((scene) => (
              <option key={scene} value={scene}>
                {scene}
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
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
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
              {sceneOptions.map((scene) => (
                <option key={scene} value={scene}>
                  {scene}
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
              {levelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
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
        </div>

        <p className="metaText">
          表示件数: {filteredPhrases.length} / 登録件数: {phrases.length}
        </p>

        {filteredPhrases.length === 0 ? (
          <div className="emptyState">条件に一致する教材がありません。</div>
        ) : (
          <div className="tableWrap">
            <table className="historyTable">
              <thead>
                <tr>
                  <th>シーン</th>
                  <th>レベル</th>
                  <th>日本語</th>
                  <th>英語</th>
                  <th>ヒント</th>
                  <th>作成日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhrases.map((phrase) => (
                  <tr key={phrase.id}>
                    <td>{phrase.scene}</td>
                    <td>{phrase.level}</td>
                    <td>{phrase.japanese}</td>
                    <td>{phrase.english}</td>
                    <td>{phrase.hint}</td>
                    <td>{formatDate(phrase.created_at)}</td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
