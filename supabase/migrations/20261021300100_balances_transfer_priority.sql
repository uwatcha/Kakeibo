-- ホームの振替の提案で使うので、残高のビューにも振替の優先度を出す（列は末尾にだけ足せる）
create or replace view account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.is_reserved, a.is_archived, a.sort_order,
       a.opening_balance
       + coalesce(sum(t.amount) filter (where t.to_account_id   = a.id), 0)
       - coalesce(sum(t.amount) filter (where t.from_account_id = a.id), 0) as balance,
       a.include_in_available,
       a.transfer_priority
from accounts a
left join transactions t
  on a.id in (t.from_account_id, t.to_account_id)
 and t.date <= (now() at time zone 'Asia/Tokyo')::date
group by a.id;
