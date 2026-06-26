"use client";

import { useMemo, useState } from "react";
import { playCorrectSound, playWrongSound } from "@/lib/audio";
import {
  CONVERSATION_LEVEL_OPTIONS,
  getConversationLevelLabel,
  parseConversationTurns,
  type ConversationTurn,
} from "@/lib/conversation";
import { getSceneLabel } from "@/lib/constants";
import { averageScore, toPercent } from "@/lib/learning";
import { scoreAnswer, type ScoreBreakdown } from "@/lib/scoring";
import { speakEnglish } from "@/lib/speech";
import {
  createSupabaseClient,
  type ConversationLevel,
  type ConversationScenario,
} from "@/lib/supabase";

type UserAnswerResult = ScoreBreakdown & {
  expected: string;
  userAnswer: string;
  isCorrect: boolean;
};

type ConversationClientProps = {
  initialScenarios: ConversationScenario[];
  initialErrorMessage: string | null;
};

function getScenes(scenarios: ConversationScenario[]): string[] {
  return Array.from(new Set(scenarios.map((scenario) => scenario.scene))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

function getUserTurnCount(turns: ConversationTurn[]): number {
  return turns.filter((turn) => turn.speaker === "user").length;
}

export function ConversationClient({
  initialScenarios,
  initialErrorMessage,
}: ConversationClientProps) {
  const [selectedScene, setSelectedScene] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState<ConversationLevel | "all">("all");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [currentResult, setCurrentResult] = useState<UserAnswerResult | null>(null);
  const [results, setResults] = useState<UserAnswerResult[]>([]);
  const [message, setMessage] = useState<string | null>(initialErrorMessage);
  const [isSaving, setIsSaving] = useState(false);

  const scenes = useMemo(() => getScenes(initialScenarios), [initialScenarios]);
  const filteredScenarios = useMemo(
    () =>
      initialScenarios.filter(
        (scenario) =>
          (selectedScene === "all" || scenario.scene === selectedScene) &&
          (selectedLevel === "all" || scenario.level === selectedLevel),
      ),
    [initialScenarios, selectedLevel, selectedScene],
  );
  const activeScenario = initialScenarios.find((scenario) => scenario.id === activeScenarioId) ?? null;
  const turns = parseConversationTurns(activeScenario?.turns);
  const currentTurn = turns?.[turnIndex] ?? null;
  const isFinished = activeScenario !== null && turns !== null && turnIndex >= turns.length;
  const summary = useMemo(() => {
    const correctCount = results.filter((result) => result.isCorrect).length;
    const answerCount = results.length;

    return {
      answerCount,
      correctCount,
      averageScore: averageScore(results.map((result) => result.score)),
      completionRate: turns ? toPercent(answerCount, getUserTurnCount(turns)) : 0,
    };
  }, [results, turns]);

  function startScenario(scenario: ConversationScenario) {
    setActiveScenarioId(scenario.id);
    setTurnIndex(0);
    setAnswer("");
    setCurrentResult(null);
    setResults([]);
    setMessage(null);
  }

  function returnToList() {
    setActiveScenarioId(null);
    setTurnIndex(0);
    setAnswer("");
    setCurrentResult(null);
    setResults([]);
    setMessage(null);
  }

  function readAiTurn(text: string) {
    if (!speakEnglish(text)) {
      setMessage("このブラウザでは読み上げ機能を利用できません。");
      return;
    }

    setMessage(null);
  }

  function moveNextTurn() {
    setTurnIndex((current) => current + 1);
    setAnswer("");
    setCurrentResult(null);
    setMessage(null);
  }

  function submitAnswer(expected: string) {
    const breakdown = scoreAnswer(answer, expected);
    const nextResult: UserAnswerResult = {
      ...breakdown,
      expected,
      userAnswer: answer,
      isCorrect: breakdown.score >= 80,
    };

    setCurrentResult(nextResult);
    setResults((current) => [...current, nextResult]);

    if (nextResult.isCorrect) {
      playCorrectSound();
    } else {
      playWrongSound();
    }
  }

  async function saveConversationLog() {
    if (!activeScenario) {
      setMessage("保存できる会話シナリオがありません。");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from("conversation_logs").insert({
        scenario_id: activeScenario.id,
        score: summary.averageScore,
        is_completed: true,
        practiced_at: new Date().toISOString(),
      });

      if (error) {
        setMessage(`会話履歴の保存に失敗しました: ${error.message}`);
        return;
      }

      setMessage("会話履歴を保存しました。");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage(`会話履歴の保存に失敗しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (initialErrorMessage) {
    return <div className="errorMessage">{initialErrorMessage}</div>;
  }

  if (initialScenarios.length === 0) {
    return <div className="emptyState">会話シナリオが登録されていません。</div>;
  }

  if (!activeScenario) {
    return (
      <div className="gridTwo">
        <aside className="panel">
          <div className="field">
            <label htmlFor="conversation-scene">シーン</label>
            <select
              className="select"
              id="conversation-scene"
              value={selectedScene}
              onChange={(event) => setSelectedScene(event.target.value)}
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
            <label htmlFor="conversation-level">レベル</label>
            <select
              className="select"
              id="conversation-level"
              value={selectedLevel}
              onChange={(event) => setSelectedLevel(event.target.value as ConversationLevel | "all")}
            >
              <option value="all">全レベル</option>
              {CONVERSATION_LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {getConversationLevelLabel(level)}
                </option>
              ))}
            </select>
          </div>
          <p className="metaText">対象シナリオ: {filteredScenarios.length}件</p>
        </aside>

        <section className="panel">
          {filteredScenarios.length === 0 ? (
            <div className="emptyState">条件に一致する会話シナリオがありません。</div>
          ) : (
            <div className="phraseCardGrid">
              {filteredScenarios.map((scenario) => {
                const scenarioTurns = parseConversationTurns(scenario.turns);

                return (
                  <article className="phraseCard" key={scenario.id}>
                    <div className="phraseCardMeta">
                      <span>{getSceneLabel(scenario.scene)}</span>
                      <span>{getConversationLevelLabel(scenario.level)}</span>
                      <span>{scenarioTurns ? `${getUserTurnCount(scenarioTurns)}回答` : "形式不正"}</span>
                    </div>
                    <div className="phraseCardBody">
                      <h2 className="sectionTitle">{scenario.title}</h2>
                      <p className="phraseCardText">{scenario.description || "説明はありません。"}</p>
                    </div>
                    <div className="phraseCardFooter">
                      <button
                        className="button buttonPrimaryAction"
                        type="button"
                        onClick={() => startScenario(scenario)}
                        disabled={!scenarioTurns}
                      >
                        会話を開始する
                      </button>
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

  if (!turns) {
    return (
      <section className="panel">
        <div className="errorMessage">会話シナリオのturns形式が不正です。</div>
        <button className="button buttonSecondary formGap" type="button" onClick={returnToList}>
          一覧へ戻る
        </button>
      </section>
    );
  }

  if (isFinished) {
    return (
      <section className="panel">
        <h2 className="sectionTitle">{activeScenario.title} の結果</h2>
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">回答数</span>
            <strong>{summary.answerCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正解数</span>
            <strong>{summary.correctCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">平均スコア</span>
            <strong>{summary.averageScore}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">達成率</span>
            <strong>{summary.completionRate}%</strong>
          </div>
        </div>
        <div className="buttonRow formGap">
          <button className="button buttonPrimaryAction" type="button" onClick={saveConversationLog} disabled={isSaving}>
            {isSaving ? "保存中" : "結果を保存する"}
          </button>
          <button className="button buttonSecondary" type="button" onClick={() => startScenario(activeScenario)}>
            もう一度練習する
          </button>
          <button className="button buttonSecondary" type="button" onClick={returnToList}>
            一覧へ戻る
          </button>
        </div>
        {message ? <p className="metaText">{message}</p> : null}
      </section>
    );
  }

  if (!currentTurn) {
    return null;
  }

  return (
    <section className="panel">
      <p className="metaText">
        {activeScenario.title} / {turnIndex + 1} / {turns.length}
      </p>
      {currentTurn.speaker === "ai" ? (
        <>
          <div className="phraseBox">
            <span className="phraseLabel">相手</span>
            <p className="japanesePhrase">{currentTurn.text}</p>
            <p className="metaText">{currentTurn.translation}</p>
          </div>
          <div className="buttonRow formGap">
            <button className="button buttonPrimaryAction" type="button" onClick={() => readAiTurn(currentTurn.text)}>
              音声を聞く
            </button>
            <button className="button buttonSecondary" type="button" onClick={moveNextTurn}>
              次へ
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="phraseBox">
            <span className="phraseLabel">あなたの番</span>
            <p className="japanesePhrase">{currentTurn.translation}</p>
          </div>
          <div className="field formGap">
            <label htmlFor="conversation-answer">英語で回答</label>
            <textarea
              className="textarea"
              id="conversation-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={currentResult !== null}
            />
          </div>
          <div className="buttonRow formGap">
            {currentResult ? (
              <button className="button buttonPrimaryAction" type="button" onClick={moveNextTurn}>
                次へ
              </button>
            ) : (
              <button className="button buttonPrimaryAction" type="button" onClick={() => submitAnswer(currentTurn.expected)}>
                回答を確認する
              </button>
            )}
          </div>
          {currentResult ? (
            <section className="resultGrid sectionGap" aria-live="polite">
              <div className="scoreCircle">{currentResult.score}</div>
              <div className="answerBlock">
                <p>
                  <strong>判定:</strong> {currentResult.isCorrect ? "正解" : "不正解"} / {currentResult.label}
                </p>
                <p>
                  <strong>期待される英文:</strong> {currentResult.expected}
                </p>
                <p>
                  <strong>あなたの回答:</strong> {currentResult.userAnswer || "未入力"}
                </p>
              </div>
            </section>
          ) : null}
        </>
      )}
      {message ? <p className="metaText">{message}</p> : null}
    </section>
  );
}
