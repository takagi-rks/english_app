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

TOEIC mode uses separate tables from the phrase practice tables.

```sql
create table toeic_questions (
  id uuid primary key default gen_random_uuid(),
  part text not null check (part in ('part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7')),
  question_text text not null,
  choices jsonb not null,
  correct_choice text not null check (correct_choice in ('A', 'B', 'C', 'D')),
  explanation text,
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  tags text[] not null default '{}',
  created_at timestamptz default now(),
  constraint toeic_questions_unique_question unique (part, question_text, difficulty)
);

create table toeic_practice_logs (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references toeic_questions(id) on delete cascade,
  selected_choice text not null check (selected_choice in ('A', 'B', 'C', 'D')),
  correct_choice text not null check (correct_choice in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  practiced_at timestamptz not null default now()
);
```

Conversation mode uses fixed scenario tables and does not call any AI API.

```sql
create table if not exists conversation_scenarios (
  id uuid primary key default gen_random_uuid(),
  scene text not null,
  title text not null,
  description text,
  level text not null default 'beginner',
  turns jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists conversation_logs (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references conversation_scenarios(id) on delete cascade,
  score int not null,
  is_completed boolean not null default false,
  practiced_at timestamptz not null default now()
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

For an existing project, apply this migration to add TOEIC practice without changing the existing phrase tables.

```sql
create table if not exists toeic_questions (
  id uuid primary key default gen_random_uuid(),
  part text not null,
  question_text text not null,
  choices jsonb not null,
  correct_choice text not null,
  explanation text,
  difficulty text not null default 'beginner',
  tags text[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists toeic_practice_logs (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references toeic_questions(id) on delete cascade,
  selected_choice text not null,
  correct_choice text not null,
  is_correct boolean not null,
  practiced_at timestamptz not null default now()
);

alter table toeic_questions
  drop constraint if exists toeic_questions_part_check;

alter table toeic_questions
  add constraint toeic_questions_part_check
  check (part in ('part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7'));

alter table toeic_questions
  drop constraint if exists toeic_questions_difficulty_check;

alter table toeic_questions
  add constraint toeic_questions_difficulty_check
  check (difficulty in ('beginner', 'intermediate', 'advanced'));

alter table toeic_questions
  drop constraint if exists toeic_questions_correct_choice_check;

alter table toeic_questions
  add constraint toeic_questions_correct_choice_check
  check (correct_choice in ('A', 'B', 'C', 'D'));

alter table toeic_practice_logs
  drop constraint if exists toeic_practice_logs_selected_choice_check;

alter table toeic_practice_logs
  add constraint toeic_practice_logs_selected_choice_check
  check (selected_choice in ('A', 'B', 'C', 'D'));

alter table toeic_practice_logs
  drop constraint if exists toeic_practice_logs_correct_choice_check;

alter table toeic_practice_logs
  add constraint toeic_practice_logs_correct_choice_check
  check (correct_choice in ('A', 'B', 'C', 'D'));

alter table toeic_questions
  drop constraint if exists toeic_questions_unique_question;

alter table toeic_questions
  add constraint toeic_questions_unique_question
  unique (part, question_text, difficulty);
```

For conversation mode, apply this migration to add the fixed scenario tables.

```sql
create table if not exists conversation_scenarios (
  id uuid primary key default gen_random_uuid(),
  scene text not null,
  title text not null,
  description text,
  level text not null default 'beginner',
  turns jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists conversation_logs (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references conversation_scenarios(id) on delete cascade,
  score int not null,
  is_completed boolean not null default false,
  practiced_at timestamptz not null default now()
);

alter table conversation_scenarios
  drop constraint if exists conversation_scenarios_level_check;

alter table conversation_scenarios
  add constraint conversation_scenarios_level_check
  check (level in ('beginner', 'intermediate', 'advanced'));

alter table conversation_logs
  drop constraint if exists conversation_logs_score_check;

alter table conversation_logs
  add constraint conversation_logs_score_check
  check (score >= 0 and score <= 100);
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

A 20-row original TOEIC starter CSV is available at `docs/toeic-sample-questions.csv`.

`/toeic/questions` also supports UTF-8 CSV import for bulk TOEIC question registration.
Sample CSV files are available at `docs/toeic_part5_100.csv` and `docs/toeic_part2_50.csv`.

Required columns:

```text
part,question_text,choice_a,choice_b,choice_c,choice_d,correct_choice,difficulty
```

Optional columns:

```text
explanation,tags
```

Full header example:

```csv
part,question_text,choice_a,choice_b,choice_c,choice_d,correct_choice,explanation,difficulty,tags
part5,"The report was submitted ------- yesterday.",recent,recently,recency,more recent,B,Recently is an adverb.,beginner,adverb|word-form
```

`part` accepts `part1` through `part7`; `difficulty` accepts `beginner`, `intermediate`, or `advanced`; `correct_choice` accepts `A`, `B`, `C`, or `D`. `tags` accepts multiple values separated by `|`.

Import steps:

1. Open `/toeic/questions`.
2. Choose a UTF-8 CSV file in the CSV import area.
3. Review the preview. Invalid rows and duplicates are skipped with Japanese reasons.
4. Click the import button to insert valid rows.

During import, `choice_a` through `choice_d` are converted into the `choices` jsonb value:

```json
{
  "A": "choice_a",
  "B": "choice_b",
  "C": "choice_c",
  "D": "choice_d"
}
```

## Conversation Scenario Seeds

These scenarios are original fixed scripts. They do not use AI.

```sql
insert into conversation_scenarios (scene, title, description, level, turns) values
('cafe', 'カフェ注文', 'カフェで飲み物を注文する会話です。', 'beginner', '[
  {"speaker":"ai","text":"Welcome. What would you like to order?","translation":"いらっしゃいませ。何を注文しますか？"},
  {"speaker":"user","expected":"I would like a coffee, please.","translation":"コーヒーをください。"},
  {"speaker":"ai","text":"Sure. Would you like it hot or iced?","translation":"かしこまりました。ホットとアイスのどちらにしますか？"},
  {"speaker":"user","expected":"I would like it hot.","translation":"ホットでお願いします。"},
  {"speaker":"ai","text":"Anything else?","translation":"他にご注文はありますか？"},
  {"speaker":"user","expected":"That is all, thank you.","translation":"以上です、ありがとうございます。"}
]'::jsonb),
('hotel', 'ホテルチェックイン', 'ホテルのフロントでチェックインします。', 'beginner', '[
  {"speaker":"ai","text":"Good evening. Do you have a reservation?","translation":"こんばんは。ご予約はありますか？"},
  {"speaker":"user","expected":"Yes, I have a reservation under Sato.","translation":"はい、佐藤の名前で予約しています。"},
  {"speaker":"ai","text":"May I see your passport, please?","translation":"パスポートを拝見できますか？"},
  {"speaker":"user","expected":"Here you are.","translation":"どうぞ。"},
  {"speaker":"ai","text":"Your room is on the fifth floor.","translation":"お部屋は5階です。"},
  {"speaker":"user","expected":"Thank you very much.","translation":"ありがとうございます。"}
]'::jsonb),
('directions', '道案内', '駅までの行き方を尋ねる会話です。', 'beginner', '[
  {"speaker":"ai","text":"Hello. Can I help you?","translation":"こんにちは。お手伝いしましょうか？"},
  {"speaker":"user","expected":"How can I get to the station?","translation":"駅にはどう行けばいいですか？"},
  {"speaker":"ai","text":"Go straight for two blocks and turn left.","translation":"2ブロックまっすぐ進んで左に曲がってください。"},
  {"speaker":"user","expected":"How long does it take?","translation":"どのくらい時間がかかりますか？"},
  {"speaker":"ai","text":"It takes about ten minutes on foot.","translation":"歩いて約10分です。"},
  {"speaker":"user","expected":"Thank you for your help.","translation":"助けてくれてありがとうございます。"}
]'::jsonb),
('restaurant', 'レストラン予約', '電話でレストランを予約します。', 'intermediate', '[
  {"speaker":"ai","text":"Thank you for calling Green Table.","translation":"グリーンテーブルにお電話ありがとうございます。"},
  {"speaker":"user","expected":"I would like to make a reservation for tonight.","translation":"今夜の予約をしたいです。"},
  {"speaker":"ai","text":"How many people are in your party?","translation":"何名様ですか？"},
  {"speaker":"user","expected":"A table for two, please.","translation":"2名でお願いします。"},
  {"speaker":"ai","text":"What time would you like to come?","translation":"何時に来店されますか？"},
  {"speaker":"user","expected":"At seven thirty, please.","translation":"7時半でお願いします。"},
  {"speaker":"ai","text":"Your reservation is confirmed.","translation":"ご予約を承りました。"},
  {"speaker":"user","expected":"Thank you. See you tonight.","translation":"ありがとうございます。今夜伺います。"}
]'::jsonb),
('shopping', '買い物', '店員にサイズや値段を尋ねます。', 'beginner', '[
  {"speaker":"ai","text":"Hi. Are you looking for anything special?","translation":"こんにちは。何かお探しですか？"},
  {"speaker":"user","expected":"I am looking for a jacket.","translation":"ジャケットを探しています。"},
  {"speaker":"ai","text":"What size do you need?","translation":"サイズはいくつですか？"},
  {"speaker":"user","expected":"Do you have this in medium?","translation":"これのMサイズはありますか？"},
  {"speaker":"ai","text":"Yes, here it is.","translation":"はい、こちらです。"},
  {"speaker":"user","expected":"How much is it?","translation":"これはいくらですか？"}
]'::jsonb),
('airport', '空港チェックイン', '空港カウンターで搭乗手続きをします。', 'intermediate', '[
  {"speaker":"ai","text":"May I have your passport and ticket?","translation":"パスポートと航空券をお願いします。"},
  {"speaker":"user","expected":"Sure. Here they are.","translation":"はい、こちらです。"},
  {"speaker":"ai","text":"Do you have any bags to check?","translation":"お預けの荷物はありますか？"},
  {"speaker":"user","expected":"Yes, I have one suitcase.","translation":"はい、スーツケースが1つあります。"},
  {"speaker":"ai","text":"Would you like a window seat or an aisle seat?","translation":"窓側と通路側のどちらがよろしいですか？"},
  {"speaker":"user","expected":"I would like an aisle seat, please.","translation":"通路側の席をお願いします。"},
  {"speaker":"ai","text":"Here is your boarding pass.","translation":"搭乗券です。"},
  {"speaker":"user","expected":"Thank you. Which gate should I go to?","translation":"ありがとうございます。どのゲートに行けばいいですか？"}
]'::jsonb);
```

## Phase4 Features

- The home page is a learning dashboard with today's answers, accuracy, goal progress, XP, streaks, badges, and recommended next practice.
- Pronunciation evaluation on `/practice` uses the browser Web Speech API SpeechRecognition.
- Listening mode on `/listening` reads the correct English aloud without showing it first, then scores the typed answer.
- Shadowing mode on `/shadowing` reads the phrase aloud, records the learner with SpeechRecognition, and compares recognized text with the correct English.
- Conversation mode on `/conversation` uses fixed Supabase scenarios, text scoring, SpeechSynthesis playback, and `conversation_logs`.
- TOEIC mode on `/toeic` uses separate TOEIC question and log tables for multiple-choice practice and simple accuracy stats.
- TOEIC question management on `/toeic/questions` supports browser-based create, edit, and delete operations.
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
