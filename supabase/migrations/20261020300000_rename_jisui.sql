-- 初期カテゴリ「食費 / 自炊」を「食費 / 食料品」に変える（改善要望より。スーパーでの買い物などを含めるため）
update categories set name = '食料品' where name = '自炊' and parent_id is not null;

create or replace function public.create_default_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  food_id uuid;
begin
  insert into public.categories (user_id, kind, name, sort_order)
  values (new.id, 'expense', '食費', 10)
  returning id into food_id;

  insert into public.categories (user_id, parent_id, kind, name, sort_order) values
    (new.id, food_id, 'expense', '食料品',       10),
    (new.id, food_id, 'expense', '外食',         20),
    (new.id, food_id, 'expense', 'カフェ / 間食', 30);

  insert into public.categories (user_id, kind, name, sort_order) values
    (new.id, 'expense', '日用品',     20),
    (new.id, 'expense', '交通',       30),
    (new.id, 'expense', '住居',       40),
    (new.id, 'expense', '水道光熱',   50),
    (new.id, 'expense', '通信',       60),
    (new.id, 'expense', '趣味・娯楽', 70),
    (new.id, 'expense', '交際',       80),
    (new.id, 'expense', '衣服・美容', 90),
    (new.id, 'expense', '医療',       100),
    (new.id, 'expense', '学び',       110),
    (new.id, 'expense', '特別な出費', 120),
    (new.id, 'expense', 'その他',     130),
    (new.id, 'income',  '仕送り',           10),
    (new.id, 'income',  '給与・アルバイト', 20),
    (new.id, 'income',  'その他',           30);
  return new;
end;
$$;
