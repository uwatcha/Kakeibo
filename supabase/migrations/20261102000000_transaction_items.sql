-- 1つの記録の内訳（2026-11-02 改善要望「1つの記録で、複数カテゴリを登録し、金額の内訳を記録できるようにする」）。
-- 記録の金額（transactions.amount）は支払った合計のまま。内訳は品目の行（品名・カテゴリ・金額）と、最後の「調整」の行
-- （is_adjustment。合計 − 品目の合計。割引・消費税の端数のずれなどを吸収する。ユーザーの指定で案C + 調整の行）。
-- 集計のカテゴリ別は内訳で数え、調整の行は「割引・調整」として数える。品目の割引はその品目の金額から引く（マイナスも可）
create table transaction_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  transaction_id uuid not null references transactions on delete cascade,
  category_id    uuid references categories on delete set null,
  name           text,
  amount         bigint not null,
  is_adjustment  boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index transaction_items_transaction_idx on transaction_items (transaction_id);
alter table transaction_items enable row level security;
create policy own_rows on transaction_items for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
