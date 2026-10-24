-- 電気・ガスの請求のお知らせのメール（2026-10-24 改善要望）。記録は作らず、定期支払いの予定の金額を直して知らせる。
-- kind: electricity_bill（電力会社）/ gas_bill（ガス会社）。status: bill（請求のお知らせ。transaction_id は直した・見つけた予定）
alter table email_imports drop constraint email_imports_kind_check;
alter table email_imports add constraint email_imports_kind_check
  check (kind in ('debit_mail', 'bank_out', 'bank_in', 'card_quick', 'card_detail', 'photo', 'electricity_bill', 'gas_bill'));
alter table email_imports drop constraint email_imports_status_check;
alter table email_imports add constraint email_imports_status_check
  check (status in (
    'new', 'pending_ai', 'recorded', 'merged', 'confirmed_plan',
    'duplicate', 'dismissed', 'notice', 'unreadable', 'ignored', 'bill'));
