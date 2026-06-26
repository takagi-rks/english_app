import { ShadowingClient } from "./shadowing-client";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getShadowingPhrases(): Promise<{
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

export default async function ShadowingPage() {
  const { phrases, errorMessage } = await getShadowingPhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>シャドーイングモード</h1>
        <p>英文を聞いた直後に同じ英文を発話し、認識結果と正解英文を比較します。</p>
      </div>
      <ShadowingClient initialPhrases={phrases} initialErrorMessage={errorMessage} />
    </section>
  );
}
