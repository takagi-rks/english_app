import Link from "next/link";
import { computeLearningSummary } from "@/lib/learning";
import { createSupabaseClient, type PracticeLog } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getLearningSummary(): Promise<{
  summary: ReturnType<typeof computeLearningSummary>;
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_practice_logs")
      .select("score, is_correct, practiced_at");

    if (error) {
      return {
        summary: computeLearningSummary([]),
        errorMessage: `学習状況の取得に失敗しました: ${error.message}`,
      };
    }

    return {
      summary: computeLearningSummary(data satisfies Pick<PracticeLog, "score" | "is_correct" | "practiced_at">[]),
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      summary: computeLearningSummary([]),
      errorMessage: `学習状況の取得に失敗しました: ${message}`,
    };
  }
}

export default async function HomePage() {
  const { summary, errorMessage } = await getLearningSummary();

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
    </section>
  );
}
