-- 初回マイグレーション（設計書（MVP）の SQL ＋ 初期カテゴリ作成・updated_at 更新）

-- ===== 型 =====
create type account_kind as enum (
  'cash',        -- 現金・タンス貯金
  'bank',        -- 銀行口座
  'emoney',      -- 電子マネー（Suica など）
  'investment',  -- 投資（NISA など）
  'credit_card', -- クレジットカード（負債）
  'payable',     -- 借りている相手（親からの借金など・負債）
  'receivable'   -- 貸している・立て替えている相手（債権）
);

create type txn_type as enum (
  'expense', 'income', 'transfer',
  'advance', 'lend', 'collect',
  'borrow', 'repay',
  'adjustment'
);

create type category_kind as enum ('expense', 'income');

-- ===== 口座 =====
create table accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  kind            account_kind not null,
  is_reserved     boolean not null default false, -- 普段使わない口座（REQ-14）
  opening_balance bigint  not null default 0,     -- 初期残高（REQ-31）
  sort_order      int     not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, id)
);

create table credit_card_settings (
  account_id           uuid primary key,
  user_id              uuid not null default auth.uid(),
  closing_day          smallint not null check (closing_day between 1 and 31), -- 31 = 月末
  payment_day          smallint not null check (payment_day between 1 and 31),
  payment_month_offset smallint not null default 1, -- 締め日の何ヶ月後に引き落とし
  payment_account_id   uuid not null,
  foreign key (user_id, account_id)         references accounts (user_id, id) on delete cascade,
  foreign key (user_id, payment_account_id) references accounts (user_id, id)
);

-- ===== カテゴリ =====
create table categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  parent_id   uuid,              -- null なら大分類
  kind        category_kind not null,
  name        text not null,
  sort_order  int     not null default 0,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, parent_id) references categories (user_id, id)
);

-- ===== 記録 =====
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  type            txn_type not null,
  date            date not null default (now() at time zone 'Asia/Tokyo')::date,
  amount          bigint not null check (amount > 0), -- 実際に動いた金額
  from_account_id uuid,
  to_account_id   uuid,
  category_id     uuid,
  payee           text,  -- 支払先・店名
  memo            text,
  list_price      bigint check (list_price >= 0),  -- 本来の金額（REQ-18、画面は後日）
  points_used     bigint check (points_used >= 0), -- 利用ポイント（同上）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (user_id, from_account_id) references accounts (user_id, id),
  foreign key (user_id, to_account_id)   references accounts (user_id, id),
  foreign key (user_id, category_id)     references categories (user_id, id),
  check (from_account_id is distinct from to_account_id),
  check (case type
    when 'expense'    then from_account_id is not null and to_account_id is null
    when 'income'     then from_account_id is null and to_account_id is not null
    when 'adjustment' then (from_account_id is null) <> (to_account_id is null)
    else                   from_account_id is not null and to_account_id is not null
  end),
  check (category_id is null or type in ('expense', 'income'))
);

create index on transactions (user_id, date desc);
create index on transactions (from_account_id);
create index on transactions (to_account_id);

create function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ===== アクセス制御（本人の行だけ読み書きできる）=====
alter table accounts             enable row level security;
alter table credit_card_settings enable row level security;
alter table categories           enable row level security;
alter table transactions         enable row level security;

create policy own_rows on accounts             for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on credit_card_settings for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on categories           for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on transactions         for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ===== 集計ビュー（RLS が効くよう security_invoker）=====
create view account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.is_reserved, a.is_archived, a.sort_order,
       a.opening_balance
       + coalesce(sum(t.amount) filter (where t.to_account_id   = a.id), 0)
       - coalesce(sum(t.amount) filter (where t.from_account_id = a.id), 0) as balance
from accounts a
left join transactions t on a.id in (t.from_account_id, t.to_account_id)
group by a.id;

-- date を timestamp にしてから切り捨てる（timestamptz 経由だとセッションのタイムゾーンに左右される）
create view monthly_summary with (security_invoker = true) as
select date_trunc('month', date::timestamp)::date as month,
       coalesce(sum(amount) filter (where type = 'income'),  0) as income,
       coalesce(sum(amount) filter (where type = 'expense'), 0) as expense
from transactions
group by 1;

create view category_monthly_expense with (security_invoker = true) as
select date_trunc('month', t.date::timestamp)::date as month,
       coalesce(c.parent_id, c.id) as category_id, -- 大分類にまとめる。null は未分類
       sum(t.amount) as amount
from transactions t
left join categories c on c.id = t.category_id
where t.type = 'expense'
group by 1, 2;

-- ===== 初期カテゴリ（ユーザー作成時に自動で作る）=====
create function public.create_default_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  food_id uuid;
begin
  insert into public.categories (user_id, kind, name, sort_order)
  values (new.id, 'expense', '食費', 10)
  returning id into food_id;

  insert into public.categories (user_id, parent_id, kind, name, sort_order) values
    (new.id, food_id, 'expense', '自炊',         10),
    (new.id, food_id, 'expense', '外食',         20),
    (new.id, food_id, 'expense', 'カフェ / 間食', 30);

  insert into public.categories (user_id, kind, name, sort_order) values
    (new.id, 'expense', '日用品',     20),
    (new.id, 'expense', '交通',       30),
    (new.id, 'expense', '住居',       40),
    (new.id, 'expense', '水道光熱',   50),
    (new.id, 'expense', '通信',       60),
    (new.id, 'expense', '趣味・娯楽', 70),
    (new.id, 'expense', '交際',       80),
    (new.id, 'expense', '衣服・美容', 90),
    (new.id, 'expense', '医療',       100),
    (new.id, 'expense', '学び',       110),
    (new.id, 'expense', '特別な出費', 120),
    (new.id, 'expense', 'その他',     130),
    (new.id, 'income',  '仕送り',           10),
    (new.id, 'income',  '給与・アルバイト', 20),
    (new.id, 'income',  'その他',           30);

  return new;
end;
$$;

revoke execute on function public.create_default_categories() from public, anon, authenticated;

create trigger on_auth_user_created_default_categories
  after insert on auth.users
  for each row execute function public.create_default_categories();
