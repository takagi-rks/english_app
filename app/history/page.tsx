import { createSupabaseClient, type PracticeLog } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getPracticeLogs(): Promise<{
  logs: PracticeLog[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_practice_logs")
      .select(
        "id, phrase_id, scene, japanese, correct_english, user_answer, score, is_correct, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return {
        logs: [],
        errorMessage: `履歴の取得に失敗しました: ${error.message}`,
      };
    }

    return { logs: data, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      logs: [],
      errorMessage: `履歴の取得に失敗しました: ${message}`,
    };
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function HistoryPage() {
  const { logs, errorMessage } = await getPracticeLogs();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>練習履歴</h1>
        <p>english_practice_logsテーブルに保存された直近100件の練習結果を表示します。</p>
      </div>

      {errorMessage ? <div className="errorMessage">{errorMessage}</div> : null}

      {!errorMessage && logs.length === 0 ? (
        <div className="emptyState">練習履歴はまだありません。</div>
      ) : null}

      {logs.length > 0 ? (
        <div className="tableWrap">
          <table className="historyTable">
            <thead>
              <tr>
                <th>日時</th>
                <th>シーン</th>
                <th>日本語</th>
                <th>回答</th>
                <th>正解</th>
                <th>点数</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>
                  <td>{log.scene}</td>
                  <td>{log.japanese}</td>
                  <td>{log.user_answer}</td>
                  <td>{log.correct_english}</td>
                  <td>{log.score}</td>
                  <td>{log.is_correct ? "正解" : "復習"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
