import { ToeicClient } from "./toeic-client";
import { createSupabaseClient, type ToeicPracticeLog, type ToeicQuestion } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getToeicData(): Promise<{
  questions: ToeicQuestion[];
  logs: ToeicPracticeLog[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const [questionsResult, logsResult] = await Promise.all([
      supabase
        .from("toeic_questions")
        .select("id, part, question_text, choices, correct_choice, explanation, difficulty, tags, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("toeic_practice_logs")
        .select("id, question_id, selected_choice, correct_choice, is_correct, practiced_at")
        .order("practiced_at", { ascending: false })
        .limit(500),
    ]);

    if (questionsResult.error) {
      return {
        questions: [],
        logs: [],
        errorMessage: `TOEIC問題の取得に失敗しました: ${questionsResult.error.message}`,
      };
    }

    if (logsResult.error) {
      return {
        questions: questionsResult.data,
        logs: [],
        errorMessage: `TOEIC履歴の取得に失敗しました: ${logsResult.error.message}`,
      };
    }

    return {
      questions: questionsResult.data,
      logs: logsResult.data,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      questions: [],
      logs: [],
      errorMessage: `TOEICデータの取得に失敗しました: ${message}`,
    };
  }
}

export default async function ToeicPage() {
  const { questions, logs, errorMessage } = await getToeicData();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>TOEIC練習</h1>
        <p>Partと難易度を選び、選択式のTOEIC風オリジナル問題を1問ずつ練習します。</p>
      </div>
      <ToeicClient initialQuestions={questions} initialLogs={logs} initialErrorMessage={errorMessage} />
    </section>
  );
}
