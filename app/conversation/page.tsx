import { ConversationClient } from "./conversation-client";
import { createSupabaseClient, type ConversationScenario } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getConversationScenarios(): Promise<{
  scenarios: ConversationScenario[];
  errorMessage: string | null;
}> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("conversation_scenarios")
      .select("id, scene, title, description, level, turns, created_at")
      .order("scene", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return {
        scenarios: [],
        errorMessage: `会話シナリオの取得に失敗しました: ${error.message}`,
      };
    }

    return { scenarios: data, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラーです。";
    return {
      scenarios: [],
      errorMessage: `会話シナリオの取得に失敗しました: ${message}`,
    };
  }
}

export default async function ConversationPage() {
  const { scenarios, errorMessage } = await getConversationScenarios();

  return (
    <section className="page">
      <div className="pageHeader">
        <h1>会話練習</h1>
        <p>固定シナリオを使い、実際のやり取りに近い流れで英会話を練習します。</p>
      </div>
      <ConversationClient initialScenarios={scenarios} initialErrorMessage={errorMessage} />
    </section>
  );
}
