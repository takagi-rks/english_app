import { ChallengeClient } from "./challenge-client";
import { createSupabaseClient, type Phrase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getChallengePhrases(): Promise<{
  phrases: Phrase[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("english_phrases")
      .select("id, scene, japanese, english, hint, level, created_at");

    if (error) {
      return {
        phrases: [],
        errorMessage: `教材の取得に失敗しました: ${error.message}`,
      };
    }

    return {
      phrases: data,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      phrases: [],
      errorMessage: `教材の取得に失敗しました: ${message}`,
    };
  }
}

export default async function ChallengePage() {
  const { phrases, errorMessage } = await getChallengePhrases();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>今日の10問チャレンジ</h1>
        <p>ランダムに選ばれた最大10問を、1問ずつテンポよく練習します。</p>
      </div>
      <ChallengeClient phrases={phrases} initialErrorMessage={errorMessage} />
    </section>
  );
}
