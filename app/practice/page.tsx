import { PracticeClient } from "./practice-client";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getPhrases(): Promise<{
  phrases: Phrase[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_phrases")
      .select("id, scene, japanese, english, created_at")
      .order("scene", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return {
        phrases: [],
        errorMessage: `教材の取得に失敗しました: ${error.message}`,
      };
    }

    return { phrases: data, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      phrases: [],
      errorMessage: `教材の取得に失敗しました: ${message}`,
    };
  }
}

export default async function PracticePage() {
  const { phrases, errorMessage } = await getPhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>フレーズ練習</h1>
        <p>
          シーンを選び、日本語フレーズを英語で回答してください。回答後に採点し、正解英文を表示します。
        </p>
      </div>
      <PracticeClient initialPhrases={phrases} initialErrorMessage={errorMessage} />
    </section>
  );
}
