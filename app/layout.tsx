import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Phrase Practice",
  description: "日常英会話フレーズ練習アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <header className="siteHeader">
          <Link className="brand" href="/">
            English Practice
          </Link>
          <nav className="navLinks" aria-label="メインナビゲーション">
            <Link href="/practice">練習</Link>
            <Link href="/listening">リスニング</Link>
            <Link href="/shadowing">シャドーイング</Link>
            <Link href="/challenge">10問チャレンジ</Link>
            <Link href="/weak-phrases">苦手復習</Link>
            <Link href="/stats">学習統計</Link>
            <Link href="/history">履歴</Link>
            <Link href="/phrases">教材管理</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
