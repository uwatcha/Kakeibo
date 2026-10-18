-- 定期支払い（REQ-13）。ルールに従って記録を自動で追加し、追加した記録はルールにたどれるようにする

-- 休みの日（土日祝・年末年始）に当たったときの扱い。none = ずらさない
create type recurring_shift as enum ('none', 'before', 'after');

create table recurring_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,                 -- 記録の「内容」になる
  type            txn_type not null check (type in ('expense', 'income', 'transfer')),
  amount          bigint not null check (amount > 0),
  from_account_id uuid,
  to_account_id   uuid,
  category_id     uuid,
  day_of_month    smallint not null check (day_of_month between 1 and 31), -- 31 = 月末
  interval_months smallint not null default 1 check (interval_months between 1 and 12),
  start_date      date not null,                 -- 最初の回の月。ここから interval_months ごと
  holiday_shift   recurring_shift not null default 'none',
  is_active       boolean not null default true, -- false の間は記録を追加しない
  generated_until date,                          -- この日までの回は追加済み（消した記録を作り直さないため）
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, from_account_id) references accounts (user_id, id),
  foreign key (user_id, to_account_id)   references accounts (user_id, id),
  foreign key (user_id, category_id)     references categories (user_id, id),
  check (case type
    when 'expense' then from_account_id is not null and to_account_id is null
    when 'income'  then from_account_id is null and to_account_id is not null
    else                from_account_id is not null and to_account_id is not null
  end),
  check (category_id is null or type in ('expense', 'income'))
);

alter table recurring_rules enable row level security;
create policy own_rows on recurring_rules for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 自動で追加した記録はルールにたどれる。ルールを消しても記録は残す（ルールへの参照だけ外す）
alter table transactions add column recurring_rule_id uuid;
alter table transactions
  add constraint transactions_recurring_rule_fk
  foreign key (user_id, recurring_rule_id) references recurring_rules (user_id, id)
  on delete set null (recurring_rule_id);
-- 同じルールの同じ日の記録を二重に作らない
alter table transactions add constraint transactions_recurring_rule_date_key unique (recurring_rule_id, date);
