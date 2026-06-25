import Link from "next/link";
import { computeBadges, computeLearningSummary, computeLevelProgress } from "@/lib/learning";
import { createSupabaseClient, type PracticeLog } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getLearningSummary(): Promise<{
  summary: ReturnType<typeof computeLearningSummary>;
  levelProgress: ReturnType<typeof computeLevelProgress>;
  badges: ReturnType<typeof computeBadges>;
  errorMessage: string | null;
}> {
  const emptySummary = computeLearningSummary([]);
  const emptyLevelProgress = computeLevelProgress([]);
  const emptyBadges = computeBadges([], emptySummary);

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_practice_logs")
      .select("score, is_correct, practiced_at, pronunciation_score");

    if (error) {
      return {
        summary: emptySummary,
        levelProgress: emptyLevelProgress,
        badges: emptyBadges,
        errorMessage: `学習状況の取得に失敗しました: ${error.message}`,
      };
    }

    const logs = data satisfies Pick<
      PracticeLog,
      "score" | "is_correct" | "practiced_at" | "pronunciation_score"
    >[];
    const summary = computeLearningSummary(logs);

    return {
      summary,
      levelProgress: computeLevelProgress(logs),
      badges: computeBadges(logs, summary),
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      summary: emptySummary,
      levelProgress: emptyLevelProgress,
      badges: emptyBadges,
      errorMessage: `学習状況の取得に失敗しました: ${message}`,
    };
  }
}

export default async function HomePage() {
  const { summary, levelProgress, badges, errorMessage } = await getLearningSummary();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>日常英会話フレーズ練習</h1>
        <p>
          シーンを選び、日本語フレーズを英語で答える練習ができます。AI
          APIは使わず、教材と履歴はSupabaseに保存します。
        </p>
      </div>
      <div className="panel">
        <p>
          Web Speech APIに対応したブラウザでは、正解英文の読み上げと音声入力を利用できます。
          非対応ブラウザではテキスト入力のみで動作します。
        </p>
        <div className="buttonRow homeActions">
          <Link className="button" href="/practice">
            練習を始める
          </Link>
          <Link className="button buttonSecondary" href="/challenge">
            10問チャレンジ
          </Link>
          <Link className="button buttonSecondary" href="/history">
            履歴を見る
          </Link>
        </div>
      </div>
      <section className="panel sectionGap">
        <h2 className="sectionTitle">学習状況</h2>
        {errorMessage ? <div className="errorMessage">{errorMessage}</div> : null}
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">今日の回答数</span>
            <strong>{summary.todayCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">累計回答数</span>
            <strong>{summary.totalCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">現在のストリーク</span>
            <strong>{summary.currentStreak}日</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">最高ストリーク</span>
            <strong>{summary.bestStreak}日</strong>
          </div>
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">レベル</h2>
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">現在レベル</span>
            <strong>{levelProgress.level}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">現在XP</span>
            <strong>{levelProgress.totalXp}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">次のレベルまで</span>
            <strong>{levelProgress.xpToNextLevel} XP</strong>
          </div>
        </div>
        <div className="progressTrack sectionGap" aria-label={`レベル進捗 ${levelProgress.progressPercent}%`}>
          <div className="progressFill" style={{ width: `${levelProgress.progressPercent}%` }} />
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">バッジ</h2>
        <div className="badgeGrid">
          {badges.map((badge) => (
            <div className={badge.achieved ? "badgeBox badgeAchieved" : "badgeBox"} key={badge.id}>
              <strong>{badge.label}</strong>
              <span>{badge.description}</span>
              <small>{badge.achieved ? "達成済み" : "未達成"}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
