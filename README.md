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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
```

## Seed Phrases

```sql
insert into english_phrases (scene, japanese, english) values
  ('カフェ', 'コーヒーを一杯ください。', 'Could I have a cup of coffee?'),
  ('カフェ', 'ここで飲みます。', 'For here, please.'),
  ('買い物', 'これはいくらですか？', 'How much is this?'),
  ('買い物', '試着してもいいですか？', 'Can I try this on?'),
  ('道案内', '駅にはどう行けばいいですか？', 'How can I get to the station?'),
  ('道案内', 'もう一度言っていただけますか？', 'Could you say that again?'),
  ('ホテル', 'チェックインをお願いします。', 'I would like to check in.'),
  ('ホテル', '荷物を預かってもらえますか？', 'Could you keep my luggage?');
```
