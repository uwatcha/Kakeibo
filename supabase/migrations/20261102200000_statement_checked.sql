-- 明細にない記録（2026-11-02 ユーザーの要望: ネット通帳との突き合わせで、手入力したサンプル銀行の入金が通帳になかった）。
-- メールからの記録で見ている口座への手入力の記録で、数日たっても同じ動きのメールが来ないものを「明細にない」として出す。
-- 自分で明細を確かめてあった（またはそのままでよい）ものは true にして、出さない
alter table transactions add column statement_checked boolean not null default false;
