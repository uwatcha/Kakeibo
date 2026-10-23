-- 写真からの記録（2026-10-23 ユーザーの要望）。スマホの新しい写真（カメラ・スクリーンショット）をアプリが AI で見分け、
-- レシート・決済完了の画面・自販機の値段の表示なら記録する。記録・重複の可能性・通知はメールからの記録と同じ email_imports で扱う
-- （email_imports は「自動で読み取った1件」の表として使う。写真は kind = 'photo'、message_id = 'photo:' + 写真の id）
alter table email_imports drop constraint email_imports_kind_check;
alter table email_imports add constraint email_imports_kind_check
  check (kind in ('debit_mail', 'bank_out', 'bank_in', 'card_quick', 'card_detail', 'photo'));
-- 写真の重複の可能性を「追加する」ときに使う（メールは Edge Function が読み直すので使わない）
alter table email_imports
  add column payee       text,
  add column account_id  uuid references accounts on delete set null,
  add column category_id uuid references categories on delete set null;

alter table transactions drop constraint transactions_auto_source_check;
alter table transactions add constraint transactions_auto_source_check check (auto_source in ('email', 'photo'));
