-- AI 相談で添えた画像（横幅 1024px の JPEG の base64）。会話と一緒に消える（2026-11-24 ユーザーの要望）
alter table ai_messages add column images text[];
