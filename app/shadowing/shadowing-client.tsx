"use client";

import { useMemo, useRef, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import { getLevelLabel, getSceneLabel, LEVEL_OPTIONS } from "@/lib/constants";
import { evaluatePronunciation, type PronunciationEvaluation } from "@/lib/learning";
import { getSpeechRecognitionConstructor, isSpeechRecognitionSupported, speakEnglish } from "@/lib/speech";
import { createSupabaseClient, type Phrase, type PhraseLevel } from "@/lib/supabase";

type ShadowingResult = PronunciationEvaluation & {
  correctEnglish: string;
  recognizedSpeech: string;
};

type ShadowingClientProps = {
  initialPhrases: Phrase[];
  initialErrorMessage: string | null;
};

function getScenes(phrases: Phrase[]): string[] {
  return Array.from(new Set(phrases.map((phrase) => phrase.scene))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

export function ShadowingClient({ initialPhrases, initialErrorMessage }: ShadowingClientProps) {
  const [selectedScene, setSelectedScene] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState<PhraseLevel | "all">("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<ShadowingResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scenes = useMemo(() => getScenes(initialPhrases), [initialPhrases]);
  const recognitionSupported = typeof window !== "undefined" && isSpeechRecognitionSupported();
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
    recognitionRef.current?.stop();
    setCurrentIndex(nextIndex);
    setResult(null);
    setMessage(null);
    setIsListening(false);
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

    setMessage(null);
  }

  async function saveShadowingLog(nextResult: ShadowingResult) {
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
        user_answer: nextResult.recognizedSpeech,
        score: nextResult.score,
        is_correct: nextResult.score >= 80,
        practiced_at: new Date().toISOString(),
        pronunciation_score: nextResult.score,
        recognized_speech: nextResult.recognizedSpeech,
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

  function startRecognition() {
    if (!currentPhrase) {
      setMessage("発話練習できる教材がありません。");
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setMessage("このブラウザは音声認識に対応していません。Chromeなど対応ブラウザで利用してください。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const recognizedSpeech = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index][0]?.transcript ?? "",
      )
        .join(" ")
        .trim();
      const evaluation = evaluatePronunciation(recognizedSpeech, currentPhrase.english);
      const nextResult: ShadowingResult = {
        ...evaluation,
        correctEnglish: currentPhrase.english,
        recognizedSpeech,
      };

      setResult(nextResult);
      if (nextResult.score >= 80) {
        playCorrectSound();
      } else {
        playWrongSound();
      }
      void saveShadowingLog(nextResult);
    };
    recognition.onerror = () => {
      setMessage("音声認識中にエラーが発生しました。もう一度試してください。");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setResult(null);
    setMessage(null);
    setIsListening(true);
    recognition.start();
  }

  function retryCurrentQuestion() {
    setResult(null);
    setMessage(null);
  }

  function moveNext() {
    const nextIndex = filteredPhrases.length === 0 ? 0 : (currentIndex + 1) % filteredPhrases.length;
    resetQuestion(nextIndex);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (initialPhrases.length === 0) {
    return <div className="emptyState">シャドーイング用の教材が登録されていません。</div>;
  }

  return (
    <div className="gridTwo">
      <aside className="panel">
        <div className="field">
          <label htmlFor="shadowing-scene">カテゴリ</label>
          <select
            className="select"
            id="shadowing-scene"
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
          <label htmlFor="shadowing-level">レベル</label>
          <select
            className="select"
            id="shadowing-level"
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
        <p className="metaText">
          対象教材: {filteredPhrases.length}件 / 音声認識: {recognitionSupported ? "対応" : "非対応"}
        </p>
      </aside>

      <section className="panel">
        {currentPhrase ? (
          <>
            <p className="metaText">
              {currentIndex + 1} / {filteredPhrases.length} ・ {getSceneLabel(currentPhrase.scene)} /{" "}
              {getLevelLabel(currentPhrase.level)}
            </p>
            <div className="phraseBox">
              <span className="phraseLabel">{currentPhrase.japanese}</span>
              <p className="japanesePhrase">{currentPhrase.english}</p>
            </div>
            {!recognitionSupported ? (
              <p className="errorMessage formGap">
                このブラウザは音声認識に対応していません。Chromeなど対応ブラウザで利用してください。
              </p>
            ) : null}
            <div className="practiceActions formGap">
              <button className="button buttonPrimaryAction" type="button" onClick={playPhraseAudio}>
                音声を聞く
              </button>
              <div className="buttonRow buttonRowCompact">
                <button
                  className="button buttonSecondary buttonSmall"
                  type="button"
                  onClick={startRecognition}
                  disabled={!recognitionSupported || isListening || isSaving}
                >
                  {isListening ? "聞き取り中..." : "発話を開始する"}
                </button>
                <button
                  className="button buttonSecondary buttonSmall"
                  type="button"
                  onClick={retryCurrentQuestion}
                  disabled={isListening || result === null}
                >
                  もう一度挑戦する
                </button>
                <button
                  className="button buttonSecondary buttonSmall"
                  type="button"
                  onClick={moveNext}
                  disabled={isListening}
                >
                  次の問題へ
                </button>
              </div>
            </div>
            {message ? <p className="metaText">{message}</p> : null}
            {result ? (
              <section className="resultGrid sectionGap" aria-live="polite">
                <div className="scoreCircle">{result.score}</div>
                <div className="answerBlock">
                  <p>
                    <strong>判定:</strong> {result.score >= 80 ? "成功" : "再挑戦"}
                  </p>
                  <p>
                    <strong>認識された英文:</strong> {result.recognizedSpeech || "認識できませんでした"}
                  </p>
                  <p>
                    <strong>正解英文:</strong> {result.correctEnglish}
                  </p>
                  <p>
                    <strong>不一致単語:</strong>{" "}
                    {result.mismatchedWords.length > 0 ? result.mismatchedWords.join(", ") : "なし"}
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
