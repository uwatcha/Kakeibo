-- 予定として入れた記録（未来の日付・定期支払いで追加したもの）は、人が確認するまで未確認にする
alter table transactions add column is_confirmed boolean not null default true;

-- これまでに入れた予定（2026-10-20 以降の日付）は未確認から始める
update transactions set is_confirmed = false where date >= '2026-10-20';
