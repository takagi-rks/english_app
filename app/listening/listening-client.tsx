"use client";

import { useMemo, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import { getLevelLabel, getSceneLabel, LEVEL_OPTIONS } from "@/lib/constants";
import { scoreAnswer, type ScoreBreakdown } from "@/lib/scoring";
import { speakEnglish } from "@/lib/speech";
import { createSupabaseClient, type Phrase, type PhraseLevel } from "@/lib/supabase";

type ListeningResult = ScoreBreakdown & {
  correctEnglish: string;
  userAnswer: string;
};

type ListeningClientProps = {
  initialPhrases: Phrase[];
  initialErrorMessage: string | null;
};

function getScenes(phrases: Phrase[]): string[] {
  return Array.from(new Set(phrases.map((phrase) => phrase.scene))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

export function ListeningClient({ initialPhrases, initialErrorMessage }: ListeningClientProps) {
  const [selectedScene, setSelectedScene] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState<PhraseLevel | "all">("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ListeningResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hasListened, setHasListened] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const scenes = useMemo(() => getScenes(initialPhrases), [initialPhrases]);
  const filteredPhrases = useMemo(
    () =>
      initialPhrases.filter(
        (phrase) =>
          (selectedScene === "all" || phrase.scene === selectedScene) &&
          (selectedLevel === "all" || phrase.level === selectedLevel),
      ),
    [initialPhrases, selectedLevel, selectedScene],
  );
  const currentPhrase = filteredPhrases[currentIndex] ?? null;

  function resetQuestion(nextIndex = 0) {
    setCurrentIndex(nextIndex);
    setAnswer("");
    setResult(null);
    setShowHint(false);
    setHasListened(false);
    setMessage(null);
  }

  function handleFilterChange(scene: string, level: PhraseLevel | "all") {
    setSelectedScene(scene);
    setSelectedLevel(level);
    resetQuestion();
  }

  function playPhraseAudio() {
    if (!currentPhrase) {
      setMessage("読み上げできる教材がありません。");
      return;
    }

    if (!speakEnglish(currentPhrase.english)) {
      setMessage("このブラウザでは読み上げ機能を利用できません。");
      return;
    }

    setHasListened(true);
    setMessage(null);
  }

  async function saveListeningLog(nextResult: ListeningResult) {
    if (!currentPhrase) {
      return;
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
        user_answer: nextResult.userAnswer,
        score: nextResult.score,
        is_correct: nextResult.score >= 80,
        practiced_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`履歴の保存に失敗しました: ${error.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`履歴の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitAnswer() {
    if (!currentPhrase) {
      setMessage("採点できる教材がありません。");
      return;
    }

    const breakdown = scoreAnswer(answer, currentPhrase.english);
    const nextResult: ListeningResult = {
      ...breakdown,
      correctEnglish: currentPhrase.english,
      userAnswer: answer,
    };

    setResult(nextResult);
    if (nextResult.score >= 80) {
      playCorrectSound();
    } else {
      playWrongSound();
    }
    await saveListeningLog(nextResult);
  }

  function moveNext() {
    const nextIndex = filteredPhrases.length === 0 ? 0 : (currentIndex + 1) % filteredPhrases.length;
    resetQuestion(nextIndex);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (initialPhrases.length === 0) {
    return <div className="emptyState">リスニング用の教材が登録されていません。</div>;
  }

  return (
    <div className="gridTwo">
      <aside className="panel">
        <div className="field">
          <label htmlFor="listening-scene">カテゴリ</label>
          <select
            className="select"
            id="listening-scene"
            value={selectedScene}
            onChange={(event) => handleFilterChange(event.target.value, selectedLevel)}
          >
            <option value="all">全カテゴリ</option>
            {scenes.map((scene) => (
              <option key={scene} value={scene}>
                {getSceneLabel(scene)}
              </option>
            ))}
          </select>
        </div>
        <div className="field formGap">
          <label htmlFor="listening-level">レベル</label>
          <select
            className="select"
            id="listening-level"
            value={selectedLevel}
            onChange={(event) => handleFilterChange(selectedScene, event.target.value as PhraseLevel | "all")}
          >
            <option value="all">全レベル</option>
            {LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {getLevelLabel(level)}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">対象教材: {filteredPhrases.length}件</p>
      </aside>

      <section className="panel">
        {currentPhrase ? (
          <>
            <p className="metaText">
              {currentIndex + 1} / {filteredPhrases.length} ・ {getSceneLabel(currentPhrase.scene)} /{" "}
              {getLevelLabel(currentPhrase.level)}
            </p>
            <div className="phraseBox">
              <span className="phraseLabel">英文は採点後に表示されます</span>
              <p className="japanesePhrase">{showHint ? currentPhrase.hint || currentPhrase.japanese : "音声を聞いて入力してください。"}</p>
            </div>
            <div className="practiceActions formGap">
              <button className="button buttonPrimaryAction" type="button" onClick={playPhraseAudio}>
                {hasListened ? "もう一度聞く" : "音声を聞く"}
              </button>
              <button
                className="button buttonSecondary buttonSmall"
                type="button"
                onClick={() => setShowHint((current) => !current)}
              >
                ヒントを見る
              </button>
            </div>
            <div className="field formGap">
              <label htmlFor="listening-answer">聞こえた英文</label>
              <textarea
                className="textarea"
                id="listening-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={result !== null}
              />
            </div>
            <div className="buttonRow formGap">
              <button
                className="button buttonPrimaryAction"
                type="button"
                onClick={result ? moveNext : submitAnswer}
                disabled={isSaving}
              >
                {result ? "次の問題へ" : isSaving ? "保存中" : "回答を確認する"}
              </button>
            </div>
            {message ? <p className="metaText">{message}</p> : null}
            {result ? (
              <section className="resultGrid sectionGap" aria-live="polite">
                <div className="scoreCircle">{result.score}</div>
                <div className="answerBlock">
                  <p>
                    <strong>判定:</strong> {result.score >= 80 ? "正解" : "不正解"} / {result.label}
                  </p>
                  <p>
                    <strong>正解英文:</strong> {result.correctEnglish}
                  </p>
                  <p>
                    <strong>ユーザー回答:</strong> {result.userAnswer || "未入力"}
                  </p>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="emptyState">選択した条件に一致する教材がありません。</div>
        )}
      </section>
    </div>
  );
}
