import Link from "next/link";
import {
  computeBadges,
  computeLearningSummary,
  computeLevelProgress,
  getJstDateKey,
  toPercent,
} from "@/lib/learning";
import { createSupabaseClient, type PracticeLog } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DAILY_GOAL_COUNT = 10;

type HomeLog = Pick<PracticeLog, "score" | "is_correct" | "practiced_at" | "pronunciation_score">;

type TodayStats = {
  answerCount: number;
  correctCount: number;
  accuracy: number;
  goalProgress: number;
};

function computeTodayStats(logs: HomeLog[]): TodayStats {
  const todayKey = getJstDateKey(new Date());
  const todayLogs = logs.filter((log) => getJstDateKey(log.practiced_at) === todayKey);
  const correctCount = todayLogs.filter((log) => log.is_correct).length;

  return {
    answerCount: todayLogs.length,
    correctCount,
    accuracy: toPercent(correctCount, todayLogs.length),
    goalProgress: Math.min(100, toPercent(todayLogs.length, DAILY_GOAL_COUNT)),
  };
}

function getRecommendation(todayStats: TodayStats): {
  label: string;
  href: string;
} {
  if (todayStats.answerCount === 0) {
    return { label: "10問チャレンジ", href: "/challenge" };
  }

  if (todayStats.accuracy < 70) {
    return { label: "苦手復習", href: "/weak-phrases" };
  }

  if (todayStats.answerCount < DAILY_GOAL_COUNT) {
    return { label: "リスニング", href: "/listening" };
  }

  return { label: "シャドーイング", href: "/shadowing" };
}

async function getLearningSummary(): Promise<{
  summary: ReturnType<typeof computeLearningSummary>;
  levelProgress: ReturnType<typeof computeLevelProgress>;
  badges: ReturnType<typeof computeBadges>;
  todayStats: TodayStats;
  recommendation: ReturnType<typeof getRecommendation>;
  errorMessage: string | null;
}> {
  const emptySummary = computeLearningSummary([]);
  const emptyLevelProgress = computeLevelProgress([]);
  const emptyBadges = computeBadges([], emptySummary);
  const emptyTodayStats = computeTodayStats([]);
  const emptyRecommendation = getRecommendation(emptyTodayStats);

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
        todayStats: emptyTodayStats,
        recommendation: emptyRecommendation,
        errorMessage: `学習状況の取得に失敗しました: ${error.message}`,
      };
    }

    const logs = data satisfies HomeLog[];
    const summary = computeLearningSummary(logs);
    const todayStats = computeTodayStats(logs);

    return {
      summary,
      levelProgress: computeLevelProgress(logs),
      badges: computeBadges(logs, summary),
      todayStats,
      recommendation: getRecommendation(todayStats),
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      summary: emptySummary,
      levelProgress: emptyLevelProgress,
      badges: emptyBadges,
      todayStats: emptyTodayStats,
      recommendation: emptyRecommendation,
      errorMessage: `学習状況の取得に失敗しました: ${message}`,
    };
  }
}

export default async function HomePage() {
  const { summary, levelProgress, badges, todayStats, recommendation, errorMessage } =
    await getLearningSummary();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>学習ホーム</h1>
        <p>今日の進捗を確認して、次に取り組む練習へすぐ移動できます。</p>
      </div>
      <p className="metaText">
        スマホのブラウザメニューからホーム画面に追加すると、アプリのように起動できます。
      </p>

      <section className="panel">
        <h2 className="sectionTitle">今日の学習</h2>
        {errorMessage ? <div className="errorMessage">{errorMessage}</div> : null}
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">今日の学習</span>
            <strong>
              {todayStats.answerCount}/{DAILY_GOAL_COUNT}問
            </strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">今日の正解数</span>
            <strong>{todayStats.correctCount}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">正答率</span>
            <strong>{todayStats.accuracy}%</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">今日のおすすめ</span>
            <strong>{recommendation.label}</strong>
          </div>
        </div>
        <div className="progressTrack sectionGap" aria-label={`今日の目標進捗 ${todayStats.goalProgress}%`}>
          <div className="progressFill" style={{ width: `${todayStats.goalProgress}%` }} />
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">レベルと継続</h2>
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">現在Lv</span>
            <strong>{levelProgress.level}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">XP</span>
            <strong>{levelProgress.totalXp}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">ストリーク</span>
            <strong>{summary.currentStreak}日</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">累計回答数</span>
            <strong>{summary.totalCount}</strong>
          </div>
        </div>
        <div className="progressTrack sectionGap" aria-label={`レベル進捗 ${levelProgress.progressPercent}%`}>
          <div className="progressFill" style={{ width: `${levelProgress.progressPercent}%` }} />
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">今日のおすすめ</h2>
        <div className="buttonRow homeActions">
          <Link className="button buttonPrimaryAction" href={recommendation.href}>
            {recommendation.label}
          </Link>
          <Link className="button buttonSecondary" href="/practice">
            通常練習へ
          </Link>
          <Link className="button buttonSecondary" href="/challenge">
            10問チャレンジへ
          </Link>
          <Link className="button buttonSecondary" href="/listening">
            リスニングへ
          </Link>
          <Link className="button buttonSecondary" href="/shadowing">
            シャドーイングへ
          </Link>
          <Link className="button buttonSecondary" href="/weak-phrases">
            苦手復習へ
          </Link>
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">バッジ達成状況</h2>
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
