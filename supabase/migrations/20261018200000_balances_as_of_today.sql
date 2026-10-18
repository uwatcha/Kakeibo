-- 口座の残高は今日（日本時間）までの記録で計算する。未来の日付の記録（予定）は残高に含めない
create or replace view account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.is_reserved, a.is_archived, a.sort_order,
       a.opening_balance
       + coalesce(sum(t.amount) filter (where t.to_account_id   = a.id), 0)
       - coalesce(sum(t.amount) filter (where t.from_account_id = a.id), 0) as balance
from accounts a
left join transactions t
  on a.id in (t.from_account_id, t.to_account_id)
 and t.date <= (now() at time zone 'Asia/Tokyo')::date
group by a.id;
