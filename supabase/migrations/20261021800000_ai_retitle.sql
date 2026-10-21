-- 会話のタイトルを1日おきに付け直す（改善要望）。最後に AI がタイトルを付けた時刻。null ならまだ付けていない
alter table ai_conversations add column title_generated_at timestamptz;
update ai_conversations set title_generated_at = now() where title_generated;
alter table ai_conversations drop column title_generated;
