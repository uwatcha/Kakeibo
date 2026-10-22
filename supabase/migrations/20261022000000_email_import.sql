-- メールからの記録（設計書: デビットカードの利用メールから自動で記録、2026-10-22）
-- Gmail の Apps Script が通知メールの本文を Edge Function email-import に送り、そこで読み取って記録を足す。本文は保存しない

-- 人ごとの設定。Apps Script は token（連携の合言葉）で入る。保存するのはハッシュだけ
create table email_import_settings (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  token_hash    text unique,
  -- 合言葉を初めて作った時刻。これより前に届いたメールは読まない（過去のメールはさかのぼらない）
  started_at    timestamptz,
  -- 最後に Apps Script から届いた時刻（止まっていないかの確認）
  last_seen_at  timestamptz,
  -- 内容（店名）の要約ルール。AI に渡す。null なら初期値（Edge Function の DEFAULT_SUMMARY_RULES）
  summary_rules text,
  updated_at    timestamptz not null default now()
);
alter table email_import_settings enable row level security;
create policy own_rows on email_import_settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- メールの種類ごとのオンオフと口座（debit_mail = サンプルデビット、bank_mail = 連携サービス のサンプル銀行の入出金、card_mail = サンプルカード）
create table email_import_sources (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  source     text not null check (source in ('debit_mail', 'bank_mail', 'card_mail')),
  enabled    boolean not null default true,
  account_id uuid references accounts on delete set null,
  primary key (user_id, source)
);
alter table email_import_sources enable row level security;
create policy own_rows on email_import_sources for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 読み取った1件ごと。message_id + item_index で同じものを2回入れない
create table email_imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  message_id     text not null,
  item_index     int  not null default 0,
  kind           text check (kind in ('debit_mail', 'bank_out', 'bank_in', 'card_quick', 'card_detail')),
  date           date,
  amount         bigint check (amount > 0),
  raw_payee      text,
  -- new: 処理待ち / pending_ai: AI が混み合いで待ち / recorded: 記録を足した / merged: ほかのメールの記録と同じ利用
  -- confirmed_plan: 予定を確認した / duplicate: 手入力と重複の可能性 / dismissed: 重複で「追加しない」
  -- notice: 取り消しなどのお知らせ / unreadable: 読み取れなかった / ignored: オフの種類
  status         text not null check (status in (
                   'new', 'pending_ai', 'recorded', 'merged', 'confirmed_plan',
                   'duplicate', 'dismissed', 'notice', 'unreadable', 'ignored')),
  -- お知らせ・読み取れなかったメールの件名（本文は保存しない）
  subject        text,
  transaction_id uuid references transactions on delete set null,
  duplicate_of   uuid references transactions on delete set null,
  notified       boolean not null default false,
  received_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, message_id, item_index)
);
create index email_imports_user_status_idx on email_imports (user_id, status);
alter table email_imports enable row level security;
create policy own_rows on email_imports for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 利用先の対応表: メールの利用先（全角・半角をそろえたもの）→ 内容・カテゴリ。初めての利用先は AI が決めて入れ、
-- 自分で記録の内容・カテゴリを直したら learned_from = 'user' で上書きする（AI に例として渡す）
create table payee_rules (
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  raw_payee    text not null,
  kind         category_kind not null default 'expense',
  payee        text,
  category_id  uuid references categories on delete set null,
  learned_from text not null default 'ai' check (learned_from in ('ai', 'user')),
  updated_at   timestamptz not null default now(),
  primary key (user_id, raw_payee)
);
alter table payee_rules enable row level security;
create policy own_rows on payee_rules for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 記録に、自動で入った元と、自分で見たか・内容を入れる必要があるかを持つ
alter table transactions
  add column auto_source   text check (auto_source in ('email')),
  -- 自動で入った記録を「自動で追加」の一覧で見たか（残高には関係ない）
  add column auto_reviewed boolean not null default true,
  -- AI が内容（店名）を決められなかった。自分で内容を入れると false になり、対応表に覚える
  add column needs_payee   boolean not null default false,
  -- メールの利用先（対応表の見出し）
  add column raw_payee     text;
create index transactions_auto_review_idx on transactions (user_id) where not auto_reviewed or needs_payee;

-- アプリで記録の内容・カテゴリを直したら、対応表に覚える（Edge Function が直したときは覚えない）
create function learn_payee_rule() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.raw_payee is not null
     and coalesce(auth.role(), '') = 'authenticated'
     and (new.payee is distinct from old.payee or new.category_id is distinct from old.category_id) then
    insert into payee_rules (user_id, raw_payee, kind, payee, category_id, learned_from, updated_at)
    values (new.user_id, new.raw_payee, case when new.type = 'income' then 'income'::category_kind else 'expense'::category_kind end,
            new.payee, new.category_id, 'user', now())
    on conflict (user_id, raw_payee) do update
      set payee = excluded.payee, category_id = excluded.category_id, kind = excluded.kind,
          learned_from = 'user', updated_at = now();
    new.needs_payee := false;
  end if;
  return new;
end $$;
create trigger transactions_learn_payee before update on transactions
  for each row execute function learn_payee_rule();

-- 連携の合言葉を作り直す（古い合言葉は使えなくなる）。返すのは新しい合言葉そのもの（保存はハッシュだけ）
create function rotate_email_import_token() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into email_import_settings (user_id, token_hash, started_at, updated_at)
  values (auth.uid(), encode(extensions.digest(token, 'sha256'), 'hex'), now(), now())
  on conflict (user_id) do update
    set token_hash = excluded.token_hash,
        started_at = coalesce(email_import_settings.started_at, excluded.started_at),
        updated_at = now();
  return token;
end $$;
revoke all on function rotate_email_import_token() from public, anon;
grant execute on function rotate_email_import_token() to authenticated;
