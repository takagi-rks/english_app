# English Phrase Practice

Next.js App Router, Supabase, and Web Speech API based daily English phrase practice app.

## Environment

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Expected Tables

```sql
create table english_phrases (
  id uuid primary key default gen_random_uuid(),
  scene text not null,
  japanese text not null,
  english text not null,
  hint text not null default '',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  pronunciation_difficulty text not null default 'easy' check (pronunciation_difficulty in ('easy', 'normal', 'hard')),
  grammar_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint english_phrases_unique_phrase unique (scene, japanese, english, level)
);

create table english_practice_logs (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid references english_phrases(id),
  scene text not null,
  japanese text not null,
  correct_english text not null,
  user_answer text not null,
  score integer not null check (score >= 0 and score <= 100),
  is_correct boolean not null default false,
  practiced_at timestamptz not null default now(),
  pronunciation_score integer,
  recognized_speech text
);
```

For an existing project that already has `english_practice_logs`, apply this migration before using the app.

```sql
alter table english_practice_logs
  add column if not exists correct_english text;

update english_practice_logs
set correct_english = ''
where correct_english is null;

alter table english_practice_logs
  alter column correct_english set not null;

alter table english_practice_logs
  add column if not exists is_correct boolean not null default false;

alter table english_practice_logs
  add column if not exists practiced_at timestamptz not null default now();

alter table english_practice_logs
  add column if not exists pronunciation_score int,
  add column if not exists recognized_speech text;
```

For an existing project that already has `english_phrases`, apply this migration to support browser-based phrase management.

```sql
alter table english_phrases
  add column if not exists hint text not null default '';

alter table english_phrases
  add column if not exists level text not null default 'beginner';

alter table english_phrases
  add column if not exists pronunciation_difficulty text not null default 'easy',
  add column if not exists grammar_tags text[] not null default '{}';

alter table english_phrases
  drop constraint if exists english_phrases_level_check;

alter table english_phrases
  add constraint english_phrases_level_check
  check (level in ('beginner', 'intermediate', 'advanced'));

alter table english_phrases
  drop constraint if exists english_phrases_pronunciation_difficulty_check;

alter table english_phrases
  add constraint english_phrases_pronunciation_difficulty_check
  check (pronunciation_difficulty in ('easy', 'normal', 'hard'));

with duplicates as (
  select
    id,
    row_number() over (
      partition by scene, japanese, english, level
      order by created_at asc nulls last, id asc
    ) as duplicate_number
  from english_phrases
)
delete from english_phrases
where id in (
  select id
  from duplicates
  where duplicate_number > 1
);

alter table english_phrases
  drop constraint if exists english_phrases_unique_phrase;

alter table english_phrases
  add constraint english_phrases_unique_phrase
  unique (scene, japanese, english, level);
```

## Seed Phrases

```sql
insert into english_phrases (scene, japanese, english, hint, level) values
  ('cafe', 'コーヒーを一杯ください。', 'Could I have a cup of coffee?', '注文するときの丁寧な言い方です。', 'beginner'),
  ('cafe', 'ここで飲みます。', 'For here, please.', '店内利用を伝えます。', 'beginner'),
  ('shopping', 'これはいくらですか？', 'How much is this?', '値段をたずねます。', 'beginner'),
  ('shopping', '試着してもいいですか？', 'Can I try this on?', '服を試したいときに使います。', 'intermediate'),
  ('directions', '駅にはどう行けばいいですか？', 'How can I get to the station?', '目的地までの行き方を聞きます。', 'beginner'),
  ('directions', 'もう一度言っていただけますか？', 'Could you say that again?', '聞き返すときの丁寧な表現です。', 'beginner'),
  ('greeting', 'お会いできてうれしいです。', 'Nice to meet you.', '初対面のあいさつです。', 'beginner'),
  ('smalltalk', '週末はどうでしたか？', 'How was your weekend?', '軽い雑談を始める表現です。', 'intermediate');
```

## CSV Import

`/phrases` supports UTF-8 CSV import with a header row.

Required columns:

```text
scene,japanese,english,level
```

Optional columns:

```text
hint,pronunciation_difficulty,grammar_tags
```

`grammar_tags` accepts multiple tags separated by `|`.

```csv
scene,japanese,english,hint,level,pronunciation_difficulty,grammar_tags
greeting,こんにちは。,Hello.,昼の挨拶,beginner,easy,present-simple
cafe,コーヒーをください。,"I'd like a coffee please.",注文,beginner,normal,would-like|ordering
```

A 300-row starter CSV is available at `docs/sample-phrases.csv`.

## Phase4 Features

- Pronunciation evaluation on `/practice` uses the browser Web Speech API SpeechRecognition.
- Listening mode on `/listening` reads the correct English aloud without showing it first, then scores the typed answer.
- Shadowing mode on `/shadowing` reads the phrase aloud, records the learner with SpeechRecognition, and compares recognized text with the correct English.
- Learning calendar on `/stats` shows the last 35 days using `practiced_at` in Japan time.
- Level and XP are shown on `/`.
- Badges are computed from `english_practice_logs`; no badge table is required.
- Mobile UI uses wrapping navigation, larger buttons, stacked forms, and scrollable/card-like tables.

### Listening And Shadowing Notes

Listening and shadowing do not use AI or external audio sources. They use the browser Web Speech API:

- SpeechSynthesis for English text-to-speech playback
- SpeechRecognition for shadowing speech capture and pronunciation comparison

Browser support depends on the user's browser and device. Unsupported browsers show Japanese guidance and keep the rest of the app usable.

Both modes reuse the existing tables only. `/listening` stores the typed answer in `english_practice_logs.user_answer`; `/shadowing` stores recognized speech in `user_answer` and `recognized_speech`, with `pronunciation_score` set to the computed score. No `mode` column or additional table is required.

### Pronunciation Evaluation Notes

Pronunciation evaluation does not use AI. It compares SpeechRecognition text with the correct English answer using:

- text similarity
- word match rate
- word order match rate

Web Speech API support depends on the browser. Unsupported browsers show a Japanese message and continue to work with text input.

### XP Rules

- Answer: +10 XP
- Correct answer: +10 XP
- Score 100: +20 XP
- Pronunciation score 80 or higher: +10 XP

Level is calculated as:

```text
level = floor(total_xp / 100) + 1
```

### Badge Conditions

- First Step: first answer
- 10 Questions: 10 total answers
- 100 Questions: 100 total answers
- Perfect Answer: at least one 100 score
- Perfect 10: at least 10 correct answers
- 3 Day Streak: 3 consecutive learning days
- 7 Day Streak: 7 consecutive learning days
- Pronunciation Starter: at least one pronunciation evaluation
- Good Pronunciation: at least one pronunciation score of 80 or higher
