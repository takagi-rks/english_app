"use client";

import { useMemo, useRef, useState } from "react";
import { scoreAnswer, type ScoreBreakdown } from "@/lib/scoring";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

type PracticeResult = ScoreBreakdown & {
  correctEnglish: string;
  userAnswer: string;
};

type PracticeClientProps = {
  initialPhrases: Phrase[];
  initialErrorMessage: string | null;
  initialPhraseId?: string;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getScenes(phrases: Phrase[]): string[] {
  return Array.from(new Set(phrases.map((phrase) => phrase.scene))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

export function PracticeClient({
  initialPhrases,
  initialErrorMessage,
  initialPhraseId,
}: PracticeClientProps) {
  const initialPhrase = initialPhrases.find((phrase) => phrase.id === initialPhraseId);
  const [selectedScene, setSelectedScene] = useState<string>(
    () => initialPhrase?.scene ?? getScenes(initialPhrases)[0] ?? "",
  );
  const [selectedPhraseId, setSelectedPhraseId] = useState<string>(
    () => initialPhrase?.id ?? initialPhrases[0]?.id ?? "",
  );
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scenes = useMemo(() => getScenes(initialPhrases), [initialPhrases]);
  const scenePhrases = useMemo(
    () => initialPhrases.filter((phrase) => phrase.scene === selectedScene),
    [initialPhrases, selectedScene],
  );
  const selectedPhrase = useMemo(
    () => scenePhrases.find((phrase) => phrase.id === selectedPhraseId) ?? scenePhrases[0] ?? null,
    [scenePhrases, selectedPhraseId],
  );
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const recognitionSupported =
    typeof window !== "undefined" && getSpeechRecognitionConstructor() !== null;

  function speakCorrectAnswer() {
    if (!selectedPhrase || !("speechSynthesis" in window)) {
      setSaveMessage("このブラウザでは読み上げ機能を利用できません。");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectedPhrase.english);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function startListening() {
    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setSaveMessage("このブラウザでは音声入力を利用できません。テキスト入力で回答してください。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index][0]?.transcript ?? "",
      ).join(" ");
      setAnswer(transcript.trim());
    };
    recognition.onerror = () => {
      setSaveMessage("音声入力中にエラーが発生しました。テキスト入力で回答してください。");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setSaveMessage(null);
    recognition.start();
  }

  async function savePracticeLog(nextResult: PracticeResult) {
    if (!selectedPhrase) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("english_practice_logs").insert({
        phrase_id: selectedPhrase.id,
        scene: selectedPhrase.scene,
        japanese: selectedPhrase.japanese,
        correct_english: selectedPhrase.english,
        user_answer: nextResult.userAnswer,
        score: nextResult.score,
        is_correct: nextResult.score >= 80,
        practiced_at: new Date().toISOString(),
      });

      if (error) {
        setSaveMessage(`履歴の保存に失敗しました: ${error.message}`);
        return;
      }

      setSaveMessage("練習履歴を保存しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラーです。";
      setSaveMessage(`履歴の保存に失敗しました: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitAnswer() {
    if (!selectedPhrase) {
      setSaveMessage("採点できるフレーズがありません。");
      return;
    }

    const breakdown = scoreAnswer(answer, selectedPhrase.english);
    const nextResult: PracticeResult = {
      ...breakdown,
      correctEnglish: selectedPhrase.english,
      userAnswer: answer,
    };

    setResult(nextResult);
    speakCorrectAnswer();
    await savePracticeLog(nextResult);
  }

  function moveToNextPhrase() {
    if (scenePhrases.length === 0 || !selectedPhrase) {
      return;
    }

    const currentIndex = scenePhrases.findIndex((phrase) => phrase.id === selectedPhrase.id);
    const nextPhrase = scenePhrases[(currentIndex + 1) % scenePhrases.length];
    setSelectedPhraseId(nextPhrase.id);
    setAnswer("");
    setResult(null);
    setSaveMessage(null);
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (initialPhrases.length === 0) {
    return (
      <div className="emptyState">
        教材が登録されていません。english_phrasesテーブルに教材を追加してください。
      </div>
    );
  }

  return (
    <div className="gridTwo">
      <aside className="panel">
        <div className="field">
          <label htmlFor="scene">シーン</label>
          <select
            className="select"
            id="scene"
            value={selectedScene}
            onChange={(event) => {
              const nextScene = event.target.value;
              const firstPhrase = initialPhrases.find((phrase) => phrase.scene === nextScene);
              setSelectedScene(nextScene);
              setSelectedPhraseId(firstPhrase?.id ?? "");
              setAnswer("");
              setResult(null);
              setSaveMessage(null);
            }}
          >
            {scenes.map((scene) => (
              <option key={scene} value={scene}>
                {scene}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="phrase">フレーズ</label>
          <select
            className="select"
            id="phrase"
            value={selectedPhrase?.id ?? ""}
            onChange={(event) => {
              setSelectedPhraseId(event.target.value);
              setAnswer("");
              setResult(null);
              setSaveMessage(null);
            }}
          >
            {scenePhrases.map((phrase) => (
              <option key={phrase.id} value={phrase.id}>
                {phrase.japanese}
              </option>
            ))}
          </select>
        </div>
        <p className="metaText">
          読み上げ: {speechSupported ? "対応" : "非対応"} / 音声入力:{" "}
          {recognitionSupported ? "対応" : "非対応"}
        </p>
      </aside>

      <div className="panel">
        {selectedPhrase ? (
          <>
            <div className="phraseBox">
              <span className="phraseLabel">{selectedPhrase.scene}</span>
              <p className="japanesePhrase">{selectedPhrase.japanese}</p>
            </div>

            <div className="field" style={{ marginTop: 20 }}>
              <label htmlFor="answer">英語で回答</label>
              <textarea
                className="textarea"
                id="answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="例: Could you say that again?"
              />
            </div>

            <div className="buttonRow" style={{ marginTop: 14 }}>
              <button className="button" type="button" onClick={submitAnswer} disabled={isSaving}>
                {isSaving ? "保存中" : "回答する"}
              </button>
              <button
                className="button buttonSecondary"
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={!recognitionSupported}
              >
                {isListening ? "音声入力を停止" : "音声入力"}
              </button>
              <button className="button buttonSecondary" type="button" onClick={speakCorrectAnswer}>
                正解を聞く
              </button>
              <button className="button buttonSecondary" type="button" onClick={moveToNextPhrase}>
                次のフレーズ
              </button>
            </div>

            {saveMessage ? <p className="metaText">{saveMessage}</p> : null}

            {result ? (
              <section className="resultGrid" style={{ marginTop: 24 }} aria-live="polite">
                <div className="scoreCircle">{result.score}</div>
                <div className="answerBlock">
                  <p>
                    <strong>判定:</strong> {result.label}
                  </p>
                  <p>
                    <strong>あなたの回答:</strong> {result.userAnswer || "未入力"}
                  </p>
                  <p>
                    <strong>正解:</strong> {result.correctEnglish}
                  </p>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="emptyState">選択中のシーンにフレーズがありません。</div>
        )}
      </div>
    </div>
  );
}
