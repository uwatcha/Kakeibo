// メールからの記録（設計書: デビットカードの利用メールから自動で記録）の入り口。
// - Gmail の Apps Script（コードは src/features/emailImport/appsScript.ts）が10分ごとに、連携の合言葉と通知メールの本文を送ってくる
//   → 読み取って記録を足し（importer.ts）、返した accepted のメールを Apps Script が既読にする。本文は保存しない
// - アプリからは（ログインの JWT で）「重複の可能性」を追加する・待ちを処理する
// 届くたびに、AI の混み合いで待ちになっていたものも処理し直す（Apps Script の10分ごとの呼び出しが、そのまま再試行になる）
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { MAIL_SENDERS } from '../_shared/emailParse.ts';
import { serviceKey } from '../_shared/gemini.ts';
import { Importer, type Mail } from './importer.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    // Apps Script から: 連携の合言葉で、誰のメールかを決める
    if (typeof body.token === 'string') {
      const { data: settings } = await db
        .from('email_import_settings')
        .select('user_id, started_at')
        .eq('token_hash', await sha256Hex(body.token))
        .maybeSingle();
      if (!settings) return json({ error: '連携の合言葉が違います' }, 401);
      await db.from('email_import_settings').update({ last_seen_at: new Date().toISOString() }).eq('user_id', settings.user_id);
      const importer = new Importer(db, settings.user_id);
      await importer.load();
      const mails = ((body.messages ?? []) as Mail[]).filter((m) => m && typeof m.id === 'string').slice(0, 100);
      const accepted = await importer.ingest(mails, settings.started_at);
      await importer.process();
      // 見る送信元の一覧も返す（Apps Script が覚えて、次から使う）
      return json({ accepted, senders: MAIL_SENDERS });
    }

    // アプリから: ログインしている人
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return json({ error: 'ログインし直してください' }, 401);
    const importer = new Importer(db, auth.user.id);
    await importer.load();
    switch (body.action) {
      case 'add_duplicate':
        await importer.process(String(body.importId));
        return json({ ok: true });
      case 'process':
        await importer.process();
        return json({ ok: true });
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: '処理できませんでした' }, 500);
  }
});
