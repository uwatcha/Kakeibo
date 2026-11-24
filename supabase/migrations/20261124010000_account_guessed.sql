-- 写真から自動で入れた支払いで、支払い方法が分からず口座を推定したもの（2026-11-24 改善要望）。
-- 記録の確認の「自動で追加」で「口座を確かめてください」と出し、記録の画面で保存すると false に戻す
alter table transactions add column account_guessed boolean not null default false;
