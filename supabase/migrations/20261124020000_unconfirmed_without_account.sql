-- 未確認の記録（残高・集計に入らない）は、口座を空にしてよい（2026-11-24 ユーザーの指定）。
-- 写真で支払い方法が分からなかった支払いを、口座を決めつけずに未確認で入れ、確認するときに口座を選ぶため
alter table transactions drop constraint transactions_check1;
alter table transactions add constraint transactions_check1 check (
  case type
    when 'expense'::txn_type then to_account_id is null and (from_account_id is not null or not is_confirmed)
    when 'income'::txn_type then from_account_id is null and (to_account_id is not null or not is_confirmed)
    when 'adjustment'::txn_type then (from_account_id is null) <> (to_account_id is null)
    else (from_account_id is not null or not is_confirmed) and (to_account_id is not null or not is_confirmed)
  end
);
