-- 立て替えの記録から、何の支払いに対する立て替えかをたどれるようにする（要件 No.43）
alter table transactions add constraint transactions_user_id_id_key unique (user_id, id);
alter table transactions add column related_transaction_id uuid;
alter table transactions
  add constraint transactions_related_fk
  foreign key (user_id, related_transaction_id) references transactions (user_id, id)
  on delete set null (related_transaction_id);
alter table transactions
  add constraint transactions_related_advance_only
  check (related_transaction_id is null or type = 'advance');
create index transactions_related_idx on transactions (related_transaction_id) where related_transaction_id is not null;
