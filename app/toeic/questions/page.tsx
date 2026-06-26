import { ToeicQuestionsClient } from "./toeic-questions-client";
import { createSupabaseClient, type ToeicQuestion } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getToeicQuestions(): Promise<{
  questions: ToeicQuestion[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("toeic_questions")
      .select("id, part, question_text, choices, correct_choice, explanation, difficulty, tags, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return {
        questions: [],
        errorMessage: `TOEIC問題の取得に失敗しました: ${error.message}`,
      };
    }

    return { questions: data, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      questions: [],
      errorMessage: `TOEIC問題の取得に失敗しました: ${message}`,
    };
  }
}

export default async function ToeicQuestionsPage() {
  const { questions, errorMessage } = await getToeicQuestions();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>TOEIC問題管理</h1>
        <p>TOEIC練習用のオリジナル問題を追加、編集、削除できます。</p>
      </div>
      <ToeicQuestionsClient initialQuestions={questions} initialErrorMessage={errorMessage} />
    </section>
  );
}
