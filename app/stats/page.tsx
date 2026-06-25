import { getSceneLabel } from "@/lib/constants";
import {
  averageScore,
  computeBadges,
  computeCalendarDays,
  computeLearningSummary,
  getJstDateKey,
  toPercent,
  type Badge,
  type CalendarDay,
} from "@/lib/learning";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PracticeLogForStats = {
  scene: string;
  score: number;
  is_correct: boolean;
  practiced_at: string;
  pronunciation_score: number | null;
};

type RatioRow = {
  label: string;
  answerCount: number;
  correctCount: number;
  accuracy: number;
};

type DailyRow = RatioRow & {
  date: string;
};

type StatsData = {
  totalCount: number;
  overallAccuracy: number;
  averageScore: number;
  sceneRows: RatioRow[];
  dailyRows: DailyRow[];
  calendarDays: CalendarDay[];
  badges: Badge[];
};

function buildRatioRows<T extends string>(
  values: Map<T, { scores: number[]; correctCount: number }>,
): RatioRow[] {
  return Array.from(values.entries())
    .map(([label, value]) => ({
      label,
      answerCount: value.scores.length,
      correctCount: value.correctCount,
      accuracy: toPercent(value.correctCount, value.scores.length),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

async function getStats(): Promise<{
  stats: StatsData;
  errorMessage: string | null;
}> {
  const emptyStats: StatsData = {
    totalCount: 0,
    overallAccuracy: 0,
    averageScore: 0,
    sceneRows: [],
    dailyRows: [],
    calendarDays: computeCalendarDays([]),
    badges: computeBadges([], computeLearningSummary([])),
  };

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_practice_logs")
      .select("scene, score, is_correct, practiced_at, pronunciation_score");

    if (error) {
      return {
        stats: emptyStats,
        errorMessage: `学習統計の取得に失敗しました: ${error.message}`,
      };
    }

    const logs = data satisfies PracticeLogForStats[];
    const summary = computeLearningSummary(logs);
    const correctCount = logs.filter((log) => log.is_correct).length;
    const byScene = new Map<string, { scores: number[]; correctCount: number }>();
    const byDate = new Map<string, { scores: number[]; correctCount: number }>();

    for (const log of logs) {
      const sceneValue = byScene.get(log.scene) ?? { scores: [], correctCount: 0 };
      sceneValue.scores.push(log.score);
      sceneValue.correctCount += log.is_correct ? 1 : 0;
      byScene.set(log.scene, sceneValue);

      const dateKey = getJstDateKey(log.practiced_at);
      const dateValue = byDate.get(dateKey) ?? { scores: [], correctCount: 0 };
      dateValue.scores.push(log.score);
      dateValue.correctCount += log.is_correct ? 1 : 0;
      byDate.set(dateKey, dateValue);
    }

    const dailyRows = buildRatioRows(byDate)
      .map((row) => ({ ...row, date: row.label }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      stats: {
        totalCount: logs.length,
        overallAccuracy: toPercent(correctCount, logs.length),
        averageScore: averageScore(logs.map((log) => log.score)),
        sceneRows: buildRatioRows(byScene),
        dailyRows,
        calendarDays: computeCalendarDays(logs),
        badges: computeBadges(logs, summary),
      },
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      stats: emptyStats,
      errorMessage: `学習統計の取得に失敗しました: ${message}`,
    };
  }
}

function getCalendarClassName(day: CalendarDay, todayKey: string): string {
  const todayClass = day.dateKey === todayKey ? " calendarToday" : "";

  return `calendarCell calendarLevel${day.intensity}${todayClass}`;
}

function formatCalendarDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");

  return `${Number(month)}/${Number(day)}`;
}

function formatCalendarWeekday(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`);

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(date);
}

function Bar({ value }: { value: number }) {
  return (
    <div className="barTrack" aria-label={`${value}%`}>
      <div className="barFill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default async function StatsPage() {
  const { stats, errorMessage } = await getStats();
  const todayKey = getJstDateKey(new Date());

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>学習統計</h1>
        <p>回答履歴から正答率、平均スコア、シーン別・日別の傾向を表示します。</p>
      </div>

      {errorMessage ? <div className="errorMessage">{errorMessage}</div> : null}

      <section className="panel">
        <div className="metricGrid">
          <div className="metricBox">
            <span className="metricLabel">全体正答率</span>
            <strong>{stats.overallAccuracy}%</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">平均スコア</span>
            <strong>{stats.averageScore}</strong>
          </div>
          <div className="metricBox">
            <span className="metricLabel">累計回答数</span>
            <strong>{stats.totalCount}</strong>
          </div>
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">学習カレンダー</h2>
        <div className="calendarGrid" aria-label="過去35日分の学習カレンダー">
          {stats.calendarDays.map((day) => (
            <div
              className={getCalendarClassName(day, todayKey)}
              key={day.dateKey}
              title={`${day.dateKey}: ${day.answerCount}件`}
            >
              <span className="calendarDate">{formatCalendarDate(day.dateKey)}</span>
              <span className="calendarCount">{day.answerCount}件</span>
              <span className="calendarWeekday">{formatCalendarWeekday(day.dateKey)}</span>
              {day.dateKey === todayKey ? <span className="calendarTodayLabel">今日</span> : null}
            </div>
          ))}
        </div>
        <div className="calendarLegend" aria-label="学習量の凡例">
          <span className="legendItem">
            <span className="legendSwatch calendarLevel0" aria-hidden="true" />
            0件
          </span>
          <span className="legendItem">
            <span className="legendSwatch calendarLevel1" aria-hidden="true" />
            1〜4件
          </span>
          <span className="legendItem">
            <span className="legendSwatch calendarLevel2" aria-hidden="true" />
            5〜9件
          </span>
          <span className="legendItem">
            <span className="legendSwatch calendarLevel3" aria-hidden="true" />
            10件以上
          </span>
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">バッジ</h2>
        <div className="badgeGrid">
          {stats.badges.map((badge) => (
            <div className={badge.achieved ? "badgeBox badgeAchieved" : "badgeBox"} key={badge.id}>
              <strong>{badge.label}</strong>
              <span>{badge.description}</span>
              <small>{badge.achieved ? "達成済み" : "未達成"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">シーン別正答率</h2>
        {stats.sceneRows.length === 0 ? (
          <div className="emptyState">表示できる回答履歴がありません。</div>
        ) : (
          <div className="chartList">
            {stats.sceneRows.map((row) => (
              <div className="chartRow" key={row.label}>
                <span>{getSceneLabel(row.label)}</span>
                <Bar value={row.accuracy} />
                <strong>{row.accuracy}%</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel sectionGap">
        <h2 className="sectionTitle">日別回答数・正答率</h2>
        {stats.dailyRows.length === 0 ? (
          <div className="emptyState">表示できる回答履歴がありません。</div>
        ) : (
          <div className="chartList">
            {stats.dailyRows.map((row) => (
              <div className="chartRow" key={row.date}>
                <span>{row.date}</span>
                <Bar value={row.accuracy} />
                <strong>
                  {row.answerCount}問 / {row.accuracy}%
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
