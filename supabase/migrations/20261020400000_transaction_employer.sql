-- 収入の記録に、払ってくれた働き先（給与の支払い元）を持たせる
alter table transactions add column employer_id uuid;
alter table transactions
  add constraint transactions_employer_fk
  foreign key (user_id, employer_id) references employers (user_id, id)
  on delete set null (employer_id);
alter table transactions
  add constraint transactions_employer_income_only
  check (employer_id is null or type = 'income');
create index transactions_employer_idx on transactions (employer_id) where employer_id is not null;
