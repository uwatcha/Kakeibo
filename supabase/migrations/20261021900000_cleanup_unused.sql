-- 使われなくなった DB の部品を消す（改善要望「リファクタ」）
-- 月の収支・カテゴリ別の支出のビュー: 集計は「実質残高に含める口座」で絞るため画面側で計算していて、どこからも読まれていない
drop view if exists monthly_summary;
drop view if exists category_monthly_expense;

-- 口座の手動の並び順: 2026-10-20 に廃止（種類 → 名前の順に並べる）。残高のビューからも外す
drop view account_balances;
create view account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.is_reserved, a.is_archived,
       a.opening_balance
       + coalesce(sum(t.amount) filter (where t.to_account_id   = a.id), 0)
       - coalesce(sum(t.amount) filter (where t.from_account_id = a.id), 0) as balance,
       a.include_in_available,
       a.transfer_priority
from accounts a
left join transactions t
  on a.id in (t.from_account_id, t.to_account_id)
 and t.date <= (now() at time zone 'Asia/Tokyo')::date
 and t.is_confirmed
group by a.id;
alter table accounts drop column sort_order;
