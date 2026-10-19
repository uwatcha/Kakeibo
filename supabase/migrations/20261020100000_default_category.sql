-- 口座ごとのいつものカテゴリ（Suica なら交通など）。記録でその口座を選ぶと自動で入る
alter table accounts add column default_category_id uuid;
alter table accounts
  add constraint accounts_default_category_fk
  foreign key (user_id, default_category_id) references categories (user_id, id)
  on delete set null (default_category_id);
