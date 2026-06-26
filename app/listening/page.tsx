import { ListeningClient } from "./listening-client";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getListeningPhrases(): Promise<{
  phrases: Phrase[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_phrases")
      .select("id, scene, japanese, english, hint, level, pronunciation_difficulty, grammar_tags, created_at")
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

export default async function ListeningPage() {
  const { phrases, errorMessage } = await getListeningPhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>リスニングモード</h1>
        <p>英文を見ずに音声を聞き取り、聞こえた英語を入力して確認します。</p>
      </div>
      <ListeningClient initialPhrases={phrases} initialErrorMessage={errorMessage} />
    </section>
  );
}
