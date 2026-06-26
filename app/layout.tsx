import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ServiceWorkerRegister } from "./service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "英会話トレーナー",
  description: "英会話フレーズ、リスニング、シャドーイング、会話練習をスマホで学習できるPWAです。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "英会話",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
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
            <Link href="/conversation">会話練習</Link>
            <Link href="/toeic">TOEIC</Link>
            <Link href="/toeic/questions">TOEIC問題管理</Link>
            <Link href="/challenge">10問チャレンジ</Link>
            <Link href="/weak-phrases">苦手復習</Link>
            <Link href="/stats">学習統計</Link>
            <Link href="/history">履歴</Link>
            <Link href="/phrases">教材管理</Link>
          </nav>
        </header>
        <main>{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
