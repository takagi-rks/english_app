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
            <Link href="/history">履歴</Link>
            <Link href="/phrases">教材管理</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
