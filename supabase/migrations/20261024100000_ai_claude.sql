-- AI 相談・AI入力で Claude（Anthropic の従量課金）も使えるようにする（2026-10-24 改善要望）。
-- キーは Gemini と同じく ai_settings（ポリシーなし = アプリから読めない）に置き、Edge Function ai-chat だけが扱う。
-- saved_at はキーの期限（作ってから30日）が近づいたら知らせるため
alter table ai_settings
  add column anthropic_api_key text,
  add column anthropic_key_saved_at timestamptz;
