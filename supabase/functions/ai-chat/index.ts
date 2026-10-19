// AI の家計相談（Gemini）の中継。API キーはここでだけ扱い、アプリには返さない。
// アプリは名前を置き換えた材料（src/features/ai/anonymize.ts）と会話だけを送ってくる
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** 新しい API キー（sb_secret_...）と従来の service_role のどちらでも動くようにする */
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const first = Object.values(keys)[0];
  if (!first) throw new Error('service key not found');
  return first;
}

type Model = { id: string; label: string; inputTokenLimit: number };

async function listModels(apiKey: string): Promise<Model[]> {
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) throw new GeminiError(res.status, await res.text());
  const body = (await res.json()) as {
    models?: { name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[];
  };
  return (body.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        /^models\/gemini-/.test(m.name) &&
        !/(embedding|tts|image|audio|live|vision)/i.test(m.name),
    )
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name, inputTokenLimit: m.inputTokenLimit ?? 0 }));
}

/** 最初に選ぶモデル: 無料枠で使いやすい Flash 系（lite でないもの）を優先 */
function defaultModel(models: Model[]): string | null {
  const flash = models.filter((m) => /flash/.test(m.id) && !/lite/.test(m.id) && !/preview|exp/.test(m.id));
  return (flash[0] ?? models[0])?.id ?? null;
}

class GeminiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Gemini ${status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ error: 'ログインし直してください' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data: settings } = await db.from('ai_settings').select('*').eq('user_id', user.id).maybeSingle();

  try {
    switch (body.action) {
      case 'status': {
        if (!settings?.gemini_api_key) return json({ hasKey: false, model: null, models: [] });
        const models = await listModels(settings.gemini_api_key);
        return json({ hasKey: true, model: settings.model, models });
      }
      case 'save_key': {
        const key = String(body.key ?? '').trim();
        if (!key) return json({ error: 'API キーを入れてください' }, 400);
        // キーが使えるか、モデルの一覧が取れるかで確かめる
        const models = await listModels(key);
        const model = settings?.model && models.some((m) => m.id === settings.model) ? settings.model : defaultModel(models);
        const { error } = await db
          .from('ai_settings')
          .upsert({ user_id: user.id, gemini_api_key: key, model, updated_at: new Date().toISOString() });
        if (error) throw error;
        return json({ hasKey: true, model, models });
      }
      case 'delete_key': {
        const { error } = await db.from('ai_settings').delete().eq('user_id', user.id);
        if (error) throw error;
        return json({ hasKey: false, model: null, models: [] });
      }
      case 'set_model': {
        const { error } = await db
          .from('ai_settings')
          .update({ model: String(body.model), updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case 'chat': {
        if (!settings?.gemini_api_key || !settings.model) return json({ error: 'API キーを登録してください' }, 400);
        const messages = (body.messages ?? []) as { role: 'user' | 'model'; text: string }[];
        const res = await fetch(`${GEMINI}/models/${settings.model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': settings.gemini_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: String(body.system ?? '') }] },
            contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          }),
        });
        if (!res.ok) throw new GeminiError(res.status, await res.text());
        const out = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
        };
        const text = (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        const usage = {
          prompt: out.usageMetadata?.promptTokenCount ?? 0,
          output: out.usageMetadata?.candidatesTokenCount ?? 0,
          total: out.usageMetadata?.totalTokenCount ?? 0,
        };
        await db
          .from('ai_usage')
          .insert({ user_id: user.id, model: settings.model, prompt_tokens: usage.prompt, output_tokens: usage.output });
        return json({ text, usage, model: settings.model });
      }
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof GeminiError) {
      const message =
        e.status === 429
          ? '無料枠の上限に達しました。しばらく待ってから送ってください'
          : e.status === 400 || e.status === 401 || e.status === 403
            ? 'Gemini に断られました。API キーやモデルを確かめてください'
            : 'Gemini につながりませんでした';
      return json({ error: message, status: e.status }, 502);
    }
    return json({ error: '処理できませんでした' }, 500);
  }
});
