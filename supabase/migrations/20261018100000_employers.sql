-- 働き先と給料日（集計の「前回の給料日からの推移」に使う）

-- 給料日が土日祝のときにずらす向き。before = 直前の平日（前倒し）、after = 直後の平日（後ろ倒し）
create type payday_shift as enum ('before', 'after');

create table employers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text not null,
  payday       smallint not null check (payday between 1 and 31), -- 31 = 月末
  payday_shift payday_shift not null default 'before',
  sort_order   int     not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, id)
);

alter table employers enable row level security;

create policy own_rows on employers for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
