import { PhrasesClient } from "./phrases-client";
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
      .select(
        "id, scene, japanese, english, hint, level, pronunciation_difficulty, grammar_tags, created_at",
      )
      .order("created_at", { ascending: false });

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

export default async function PhrasesPage() {
  const { phrases, errorMessage } = await getPhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>教材管理</h1>
        <p>ブラウザから英会話フレーズ教材を追加、編集、削除できます。</p>
      </div>
      <PhrasesClient initialPhrases={phrases} initialErrorMessage={errorMessage} />
    </section>
  );
}
