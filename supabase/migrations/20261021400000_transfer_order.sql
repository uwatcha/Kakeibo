-- 振替の優先度を「高・普通・低」から並び順に変える（ユーザーの要望。専用の画面でドラッグして並べ替える）
-- transfer_priority: 0 = 振替に使わない、1 以上 = 使う順番（1 が最初）
alter table accounts drop constraint if exists accounts_transfer_priority_check;
alter table accounts add constraint accounts_transfer_priority_check check (transfer_priority >= 0);
alter table accounts alter column transfer_priority set default 0;

-- これまでの高・普通・低の順を保ったまま、1, 2, 3... の順番にする
with ranked as (
  select id, row_number() over (partition by user_id order by transfer_priority desc, sort_order, name) as rank
  from accounts
  where transfer_priority > 0
)
update accounts a set transfer_priority = r.rank from ranked r where a.id = r.id;
