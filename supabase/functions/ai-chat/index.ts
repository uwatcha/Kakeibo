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

async function generate(apiKey: string, model: string, system: string, messages: { role: string; text: string }[]) {
  const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    }),
  });
  if (!res.ok) throw new GeminiError(res.status, await res.text());
  return (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
}

/** gemini-3.5-flash → [3, 5]。版の数字がないもの（-latest など）は空 */
const version = (id: string) => (id.match(/gemini-(\d+(?:\.\d+)*)/)?.[1] ?? '').split('.').filter(Boolean).map(Number);

/** 新しい版を上に。版の数字がない「-latest」は常に最新を指すので一番上 */
function sortModels(models: Model[]): Model[] {
  const key = (m: Model) => (/-latest$/.test(m.id) ? [Infinity] : version(m.id));
  return [...models].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (y[i] ?? 0) - (x[i] ?? 0);
      if (d !== 0) return d;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * 最初に選ぶモデル・使えなくなったときの切り替え先: 常に最新の Flash を指す gemini-flash-latest を優先。
 * 古い版は一覧に出ていても新しい利用者には使えない（404）ことがあるため
 */
const FALLBACK_MODEL = 'gemini-flash-latest';
/** Flash も混み合っているときに試す、軽いモデル */
const LIGHT_FALLBACK_MODEL = 'gemini-flash-lite-latest';

/** 混み合い・一時的な障害（少し待てば通ることがある） */
const isTemporary = (status: number) => status === 500 || status === 502 || status === 503 || status === 504;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 一時的なエラーなら 1秒・3秒待って、最大2回送り直す */
async function generateWithRetry(
  apiKey: string,
  model: string,
  system: string,
  messages: { role: string; text: string }[],
) {
  for (const wait of [1000, 3000, 0]) {
    try {
      return await generate(apiKey, model, system, messages);
    } catch (e) {
      if (!(e instanceof GeminiError) || !isTemporary(e.status) || wait === 0) throw e;
      await sleep(wait);
    }
  }
  throw new Error('unreachable');
}
function defaultModel(models: Model[]): string | null {
  if (models.some((m) => m.id === FALLBACK_MODEL)) return FALLBACK_MODEL;
  const flash = models.filter((m) => /flash/.test(m.id) && !/lite|preview|exp/.test(m.id));
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
        const models = sortModels(await listModels(settings.gemini_api_key));
        return json({ hasKey: true, model: settings.model, models });
      }
      case 'save_key': {
        const key = String(body.key ?? '').trim();
        if (!key) return json({ error: 'API キーを入れてください' }, 400);
        // キーが使えるか、モデルの一覧が取れるかで確かめる
        const models = sortModels(await listModels(key));
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
        const system = String(body.system ?? '');
        // 選んだモデル → 最新の Flash → 最新の Flash-Lite の順に試す。
        // 混み合い（503 など）は少し待って送り直し、使えないモデル（404）はすぐ次へ
        const candidates = [...new Set([settings.model, FALLBACK_MODEL, LIGHT_FALLBACK_MODEL])];
        let model = settings.model;
        let out;
        let lastError: unknown;
        for (const candidate of candidates) {
          try {
            out = await generateWithRetry(settings.gemini_api_key, candidate, system, messages);
            model = candidate;
            break;
          } catch (e) {
            lastError = e;
            if (!(e instanceof GeminiError) || !(e.status === 404 || isTemporary(e.status))) throw e;
          }
        }
        if (!out) throw lastError;
        // 使えなくなっていたモデルは、切り替え先を設定にする（混み合いで切り替えただけなら設定は変えない）
        if (model !== settings.model && lastError instanceof GeminiError && lastError.status === 404) {
          await db.from('ai_settings').update({ model, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        }
        const text = (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        const usage = {
          prompt: out.usageMetadata?.promptTokenCount ?? 0,
          output: out.usageMetadata?.candidatesTokenCount ?? 0,
          total: out.usageMetadata?.totalTokenCount ?? 0,
        };
        await db
          .from('ai_usage')
          .insert({ user_id: user.id, model, prompt_tokens: usage.prompt, output_tokens: usage.output });
        return json({ text, usage, model });
      }
      case 'title': {
        // 会話の中身から短いタイトルを作る。無料枠を節約するため軽いモデルで、混み合っていたら Flash に切り替える
        if (!settings?.gemini_api_key) return json({ error: 'API キーを登録してください' }, 400);
        const messages = (body.messages ?? []) as { role: 'user' | 'model'; text: string }[];
        const transcript = messages.map((m) => `${m.role === 'user' ? '質問' : '答え'}: ${m.text}`).join('\n').slice(0, 4000);
        // 付け直しのときは今のタイトルを渡し、話題が大きく変わっていなければそのまま返してもらう
        const currentTitle = typeof body.currentTitle === 'string' ? body.currentTitle.slice(0, 60) : '';
        const system =
          '次の家計相談の会話に、内容が分かる日本語のタイトルを付けてください。20文字以内、記号や引用符なし、タイトルだけを1行で返す。「相手A」「内容1」のような名前はそのまま使う。' +
          (currentTitle
            ? `今のタイトルは「${currentTitle}」です。会話の話題が大きく変わっていなければ、今のタイトルを一字も変えずにそのまま返す。`
            : '');
        let out;
        for (const candidate of [LIGHT_FALLBACK_MODEL, FALLBACK_MODEL]) {
          try {
            out = await generateWithRetry(settings.gemini_api_key, candidate, system, [{ role: 'user', text: transcript }]);
            break;
          } catch (e) {
            if (!(e instanceof GeminiError) || !(e.status === 404 || isTemporary(e.status))) throw e;
          }
        }
        if (!out) return json({ error: 'Gemini が混み合っています' }, 502);
        const title = (out.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? '')
          .join('')
          .split('\n')[0]
          .replace(/^["'「『]|["'」』]$/g, '')
          .trim()
          .slice(0, 30);
        return json({ title });
      }
      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof GeminiError) {
      const message =
        e.status === 429
          ? '無料枠の上限に達しました。しばらく待ってから送ってください'
          : isTemporary(e.status)
            ? 'Gemini が混み合っています。少し待ってから送ってください'
            : e.status === 404
            ? 'このモデルは使えなくなりました。設定でほかのモデルを選んでください'
            : e.status === 400 || e.status === 401 || e.status === 403
              ? 'Gemini に断られました。API キーやモデルを確かめてください'
              : `Gemini につながりませんでした（${e.status}）`;
      return json({ error: message, status: e.status }, 502);
    }
    return json({ error: '処理できませんでした' }, 500);
  }
});
