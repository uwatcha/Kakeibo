-- ユーザーごとの設定。monthly_living_cost は「給料日までに使える額」の取り置きの計算に使う1か月の生活費（null なら記録から自動で見積もる）
create table user_settings (
  user_id             uuid primary key default auth.uid() references auth.users on delete cascade,
  monthly_living_cost bigint check (monthly_living_cost >= 0),
  updated_at          timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy own_rows on user_settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
