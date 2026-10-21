-- 働き先の給料の目安と入金先。両方あれば、2か月先までの給料日に収入の予定を自動で入れる（ユーザーの要望）
alter table employers add column salary_amount bigint check (salary_amount > 0);
alter table employers add column salary_account_id uuid;
alter table employers
  add constraint employers_salary_account_fk
  foreign key (user_id, salary_account_id) references accounts (user_id, id)
  on delete set null (salary_account_id);
-- どこまで予定を入れたか（消した予定を作り直さないため）
alter table employers add column salary_generated_until date;

-- 自動で入れた給料の予定の印（目安を変えたときに、今日より後の分を作り直すため）
alter table transactions add column auto_salary boolean not null default false;
create unique index transactions_auto_salary_uniq on transactions (employer_id, date) where auto_salary;
