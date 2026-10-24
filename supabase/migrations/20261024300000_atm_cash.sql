-- メールの ATM の引き出し・預け入れを、銀行と現金の振替として記録する（2026-10-24 ユーザーの要望）。
-- 振り替える現金の口座。null ならいちばん先に作った現金の口座
alter table email_import_settings
  add column atm_cash_account_id uuid references accounts on delete set null;
