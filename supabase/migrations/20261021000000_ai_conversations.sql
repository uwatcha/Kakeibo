-- AI 相談の会話の履歴。ピン留めしていない会話は、最後のやりとりから14日で消す（アプリが開いたときに消す）
create table ai_conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  title             text not null,
  pinned            boolean not null default false,
  -- 直近の返事で使ったトークン（右上のゲージ用）
  last_total_tokens int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, id)
);
alter table ai_conversations enable row level security;
create policy own_rows on ai_conversations for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index ai_conversations_user_updated_idx on ai_conversations (user_id, updated_at desc);

create table ai_messages (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('user', 'model')),
  -- 画面に出す文（元の名前）
  shown           text not null,
  -- AI に送った・AI から来た文（名前を置き換えたもの）。続きを送るときに使う
  sent            text not null,
  created_at      timestamptz not null default now(),
  foreign key (user_id, conversation_id) references ai_conversations (user_id, id) on delete cascade
);
alter table ai_messages enable row level security;
create policy own_rows on ai_messages for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index ai_messages_conversation_idx on ai_messages (conversation_id, id);
