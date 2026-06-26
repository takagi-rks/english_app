"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearPhraseChallengeDraft,
  clearToeicChallengeDraft,
  loadPhraseChallengeDraft,
  loadToeicChallengeDraft,
  type PhraseChallengeDraft,
  type ToeicChallengeDraft,
} from "@/lib/challenge-storage";

type DraftState = {
  phrase: PhraseChallengeDraft | null;
  toeic: ToeicChallengeDraft | null;
};

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ChallengeResumePanel() {
  const [drafts, setDrafts] = useState<DraftState>({ phrase: null, toeic: null });

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDrafts({
        phrase: loadPhraseChallengeDraft(),
        toeic: loadToeicChallengeDraft(),
      });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  function clearPhrase() {
    clearPhraseChallengeDraft();
    setDrafts((current) => ({ ...current, phrase: null }));
  }

  function clearToeic() {
    clearToeicChallengeDraft();
    setDrafts((current) => ({ ...current, toeic: null }));
  }

  if (!drafts.phrase && !drafts.toeic) {
    return null;
  }

  return (
    <section className="panel sectionGap" aria-live="polite">
      <h2 className="sectionTitle">途中のチャレンジがあります</h2>
      <div className="phraseCardGrid">
        {drafts.phrase ? (
          <article className="phraseCard">
            <div className="phraseCardBody">
              <strong>10問チャレンジ</strong>
              <span className="metaText">
                {drafts.phrase.currentIndex + 1} / {drafts.phrase.phraseIds.length}問目 ・ 保存:
                {formatSavedAt(drafts.phrase.savedAt)}
              </span>
            </div>
            <div className="buttonRow">
              <Link className="button buttonPrimaryAction" href="/challenge">
                続きから再開
              </Link>
              <button className="button buttonSecondary" type="button" onClick={clearPhrase}>
                最初からやり直す
              </button>
            </div>
          </article>
        ) : null}
        {drafts.toeic ? (
          <article className="phraseCard">
            <div className="phraseCardBody">
              <strong>TOEIC 10問チャレンジ</strong>
              <span className="metaText">
                {drafts.toeic.currentIndex + 1} / {drafts.toeic.questionIds.length}問目 ・ 保存:
                {formatSavedAt(drafts.toeic.savedAt)}
              </span>
            </div>
            <div className="buttonRow">
              <Link className="button buttonPrimaryAction" href="/toeic/challenge">
                続きから再開
              </Link>
              <button className="button buttonSecondary" type="button" onClick={clearToeic}>
                最初からやり直す
              </button>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
