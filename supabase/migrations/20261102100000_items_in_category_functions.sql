-- 内訳（transaction_items）のカテゴリも、カテゴリの使用数・ほかのカテゴリへ移す・削除で見る（2026-11-02）
create or replace function category_usage(target uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'transactions', (select count(*) from transactions where category_id = target)
                  + (select count(*) from transaction_items where category_id = target),
    'rules',        (select count(*) from recurring_rules where category_id = target),
    'children',     (select count(*) from categories where parent_id = target)
  );
$$;

create or replace function move_category_records(source uuid, destination uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare
  moved int;
begin
  if source = destination then raise exception 'same category'; end if;
  if (select kind from categories where id = source) is distinct from (select kind from categories where id = destination) then
    raise exception 'different kind';
  end if;
  update transactions set category_id = destination where category_id = source;
  get diagnostics moved = row_count;
  update transaction_items set category_id = destination where category_id = source;
  update recurring_rules set category_id = destination where category_id = source;
  update payee_rules set category_id = destination where category_id = source;
  update accounts set default_category_id = destination where default_category_id = source;
  return moved;
end $$;

create or replace function delete_unused_category(target uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from transactions where category_id = target)
     or exists (select 1 from transaction_items where category_id = target)
     or exists (select 1 from recurring_rules where category_id = target)
     or exists (select 1 from categories where parent_id = target) then
    raise exception 'category in use';
  end if;
  update accounts set default_category_id = null where default_category_id = target;
  delete from categories where id = target;
end $$;
