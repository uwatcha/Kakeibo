-- 汎用資産に含める口座を、普段使うかどうか（is_reserved）とは別に選べるようにする
alter table accounts add column include_in_available boolean not null default true;

-- これまでの計算（普段使わない資産の口座を除く）と同じ状態から始める
update accounts
set include_in_available = not (is_reserved and kind in ('cash', 'bank', 'emoney', 'investment'));

-- 列は末尾にだけ足せる
create or replace view account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.is_reserved, a.is_archived, a.sort_order,
       a.opening_balance
       + coalesce(sum(t.amount) filter (where t.to_account_id   = a.id), 0)
       - coalesce(sum(t.amount) filter (where t.from_account_id = a.id), 0) as balance,
       a.include_in_available
from accounts a
left join transactions t
  on a.id in (t.from_account_id, t.to_account_id)
 and t.date <= (now() at time zone 'Asia/Tokyo')::date
group by a.id;
