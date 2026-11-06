-- 支払いの内訳の行を立て替えにする（2026-11-06 改善要望: スーパーの支払いのうち、相手の分を内訳で立て替えにしたい）。
-- 立て替えの行は、元の支払いと同じ口座・同じ日の立て替えの記録として別に作り、split_from_id で元の支払いを指す。
-- 元の支払いの金額は、合計から立て替えの分を引いた自分の分。元の支払いを消したら、立て替えも一緒に消す
alter table transactions add column split_from_id uuid;
alter table transactions add constraint transactions_split_from_fkey
  foreign key (user_id, split_from_id) references transactions (user_id, id)
  on delete cascade;
alter table transactions add constraint transactions_split_from_advance
  check (split_from_id is null or type = 'advance');
create index transactions_split_from_idx on transactions (split_from_id) where split_from_id is not null;
