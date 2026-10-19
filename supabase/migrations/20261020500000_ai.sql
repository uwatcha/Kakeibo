-- AI の家計相談（Gemini）
-- API キーと選んだモデル。アプリ（publishable key）からは読み書きできず、Edge Function（ai-chat）だけが service role で扱う
create table ai_settings (
  user_id        uuid primary key references auth.users on delete cascade,
  gemini_api_key text,
  model          text,
  updated_at     timestamptz not null default now()
);
alter table ai_settings enable row level security;
-- ポリシーを作らない = 本人も含めて publishable key からは触れない

-- 1回の相談ごとの使用量（チャット画面の「今日の使用」に使う）。書き込みは Edge Function だけ
create table ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  created_at    timestamptz not null default now(),
  model         text not null,
  prompt_tokens int not null default 0,
  output_tokens int not null default 0
);
alter table ai_usage enable row level security;
create policy read_own on ai_usage for select using (user_id = (select auth.uid()));
create index ai_usage_user_created_idx on ai_usage (user_id, created_at);
