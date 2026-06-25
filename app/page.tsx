import Link from "next/link";

export default function HomePage() {
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
          <Link className="button buttonSecondary" href="/history">
            履歴を見る
          </Link>
        </div>
      </div>
    </section>
  );
}
