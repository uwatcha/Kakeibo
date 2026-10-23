-- カテゴリ・口座を消す、カテゴリの記録をまとめてほかのカテゴリへ移す（2026-10-23 ユーザーの要望）。
-- 消せるのは使われていないものだけ（記録・定期支払い・小分類・給料の入金先・カードの引き落とし口座がない）。
-- どれも security invoker なので RLS が効き、自分のものだけを扱う

-- カテゴリが使われている数
create function category_usage(target uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'transactions', (select count(*) from transactions where category_id = target),
    'rules',        (select count(*) from recurring_rules where category_id = target),
    'children',     (select count(*) from categories where parent_id = target)
  );
$$;

-- カテゴリの記録・定期支払い・利用先の対応表を、まとめてほかのカテゴリへ移す。移した記録の件数を返す
create function move_category_records(source uuid, destination uuid) returns int
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
  update recurring_rules set category_id = destination where category_id = source;
  update payee_rules set category_id = destination where category_id = source;
  update accounts set default_category_id = destination where default_category_id = source;
  return moved;
end $$;

-- 使われていないカテゴリを消す（口座の既定のカテゴリ・利用先の対応表からは外す）
create function delete_unused_category(target uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from transactions where category_id = target)
     or exists (select 1 from recurring_rules where category_id = target)
     or exists (select 1 from categories where parent_id = target) then
    raise exception 'category in use';
  end if;
  update accounts set default_category_id = null where default_category_id = target;
  delete from categories where id = target;
end $$;

-- 口座が使われている数
create function account_usage(target uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'transactions', (select count(*) from transactions where target in (from_account_id, to_account_id)),
    'rules',        (select count(*) from recurring_rules where target in (from_account_id, to_account_id)),
    'employers',    (select count(*) from employers where salary_account_id = target),
    'cards',        (select count(*) from credit_card_settings where payment_account_id = target and account_id <> target)
  );
$$;

-- 使われていない口座を消す（カードの設定は口座と一緒に消え、メールからの記録の口座の指定は外れる）
create function delete_unused_account(target uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from transactions where target in (from_account_id, to_account_id))
     or exists (select 1 from recurring_rules where target in (from_account_id, to_account_id))
     or exists (select 1 from employers where salary_account_id = target)
     or exists (select 1 from credit_card_settings where payment_account_id = target and account_id <> target) then
    raise exception 'account in use';
  end if;
  delete from credit_card_settings where account_id = target;
  delete from accounts where id = target;
end $$;

revoke all on function category_usage(uuid), move_category_records(uuid, uuid), delete_unused_category(uuid),
  account_usage(uuid), delete_unused_account(uuid) from public, anon;
grant execute on function category_usage(uuid), move_category_records(uuid, uuid), delete_unused_category(uuid),
  account_usage(uuid), delete_unused_account(uuid) to authenticated;
