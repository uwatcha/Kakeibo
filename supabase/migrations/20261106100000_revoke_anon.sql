-- ログインしていない人（anon）からは、表・ビュー・関数を一切使えないようにする（2026-11-06 ユーザーの指示: 他の人が
-- アプリや API を使えないようにする）。今も RLS で本人の行しか見えないが、権限そのものも外しておく。
-- 利用者の新しい登録は Supabase の認証の設定で止めてある（disable_signup）。利用者は管理用のスクリプトで作る
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
-- これから作る表・関数も anon には付けない
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
