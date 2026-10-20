-- 会話のタイトルを、作ってから1日たったら AI が中身から付け直す（要件 No.44）。付け直したら true
alter table ai_conversations add column title_generated boolean not null default false;
