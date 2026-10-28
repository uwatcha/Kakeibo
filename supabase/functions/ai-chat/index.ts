// AI の家計相談（Gemini・Claude）の中継。API キーはここでだけ扱い、アプリには返さない。
// アプリは名前を置き換えた材料（src/features/ai/anonymize.ts）と会話だけを送ってくる
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  checkClaudeKey,
  CLAUDE_DEFAULT_MODEL,
  CLAUDE_MODELS,
  ClaudeError,
  generateClaudeWithRetry,
  isClaudeModel,
  isClaudeTemporary,
} from '../_shared/claude.ts';
import {
  FALLBACK_MODEL,
  GEMINI,
  GeminiError,
  generateWithRetry,
  isTemporary,
  LIGHT_FALLBACK_MODEL,
  type Message,
  serviceKey,
} from '../_shared/gemini.ts';

/** Claude のキーの期限（作ってから30日。保存した日から数える） */
const CLAUDE_KEY_DAYS = 30;

type Settings = {
  gemini_api_key: string | null;
  anthropic_api_key: string | null;
  anthropic_key_saved_at: string | null;
  model: string | null;
};

/**
 * 順に試すモデル: 選んだモデル → 同じ会社の軽いモデル → もう一方の会社（キーがあれば）。
 * Gemini の混み合いが多いので、Claude のキーがあれば最後に Claude で答える（逆も同じ）
 */
function candidatesFor(settings: Settings, preferred: string | null): string[] {
  const gemini = settings.gemini_api_key ? [FALLBACK_MODEL, LIGHT_FALLBACK_MODEL] : [];
  const claude = settings.anthropic_api_key ? [CLAUDE_DEFAULT_MODEL] : [];
  const order = isClaudeModel(preferred) ? [...claude, ...gemini] : [...gemini, ...claude];
  return [...new Set([...(preferred ? [preferred] : []), ...order])].filter((m) =>
    isClaudeModel(m) ? !!settings.anthropic_api_key : !!settings.gemini_api_key,
  );
}

const canSkip = (e: unknown) =>
  e instanceof ClaudeError
    ? e.status === 404 || isClaudeTemporary(e.status)
    : e instanceof GeminiError && (e.status === 404 || isTemporary(e.status));

/** 候補を順に試し、最初に答えられたモデルの返事を返す。使えない（404）・混み合いのときだけ次へ */
async function generateAny(settings: Settings, candidates: string[], system: string, messages: Message[], asJson = false) {
  let lastError: unknown = new GeminiError(400, 'no model');
  for (const model of candidates) {
    try {
      const out = isClaudeModel(model)
        ? await generateClaudeWithRetry(settings.anthropic_api_key!, model, system, messages, asJson)
        : await generateWithRetry(settings.gemini_api_key!, model, system, messages, asJson);
      return { out, model };
    } catch (e) {
      lastError = e;
      if (!canSkip(e)) throw e;
    }
  }
  throw lastError;
}

/** Claude のキーの期限（ISO）。キーがなければ null */
const claudeExpiresAt = (settings: Settings | null) =>
  settings?.anthropic_api_key && settings.anthropic_key_saved_at
    ? new Date(new Date(settings.anthropic_key_saved_at).getTime() + CLAUDE_KEY_DAYS * 86_400_000).toISOString()
    : null;


const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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

function defaultModel(models: Model[]): string | null {
  if (models.some((m) => m.id === FALLBACK_MODEL)) return FALLBACK_MODEL;
  const flash = models.filter((m) => /flash/.test(m.id) && !/lite|preview|exp/.test(m.id));
  return (flash[0] ?? models[0])?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ error: 'ログインし直してください' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data: settings } = (await db.from('ai_settings').select('*').eq('user_id', user.id).maybeSingle()) as {
    data: Settings | null;
  };

  /** アプリに返す状態（キーそのものは返さない） */
  const statusOf = async (s: Settings | null) => {
    const geminiModels = s?.gemini_api_key ? sortModels(await listModels(s.gemini_api_key)) : [];
    const claudeModels = s?.anthropic_api_key ? CLAUDE_MODELS : [];
    return {
      hasKey: !!(s?.gemini_api_key || s?.anthropic_api_key),
      gemini: !!s?.gemini_api_key,
      claude: !!s?.anthropic_api_key,
      claudeExpiresAt: claudeExpiresAt(s),
      model: s?.model ?? null,
      models: [...geminiModels, ...claudeModels],
    };
  };

  try {
    switch (body.action) {
      case 'status':
        return json(await statusOf(settings));
      case 'save_key': {
        const key = String(body.key ?? '').trim();
        if (!key) return json({ error: 'API キーを入れてください' }, 400);
        const now = new Date().toISOString();
        let next: Settings;
        if (body.provider === 'claude') {
          // キーが使えるか、ごく短い呼び出しで確かめる。保存したら Claude を使う
          await checkClaudeKey(key);
          next = {
            gemini_api_key: settings?.gemini_api_key ?? null,
            anthropic_api_key: key,
            anthropic_key_saved_at: now,
            model: isClaudeModel(settings?.model) ? settings!.model : CLAUDE_DEFAULT_MODEL,
          };
        } else {
          // キーが使えるか、モデルの一覧が取れるかで確かめる
          const models = sortModels(await listModels(key));
          const keep = settings?.model && (isClaudeModel(settings.model) || models.some((m) => m.id === settings.model));
          next = {
            gemini_api_key: key,
            anthropic_api_key: settings?.anthropic_api_key ?? null,
            anthropic_key_saved_at: settings?.anthropic_key_saved_at ?? null,
            model: keep ? settings!.model : defaultModel(models),
          };
        }
        const { error } = await db.from('ai_settings').upsert({ user_id: user.id, ...next, updated_at: now });
        if (error) throw error;
        return json(await statusOf(next));
      }
      case 'delete_key': {
        // provider のキーだけ外す。選んでいたモデルがその会社のものなら、もう一方に切り替える
        const claude = body.provider === 'claude';
        const next: Settings = {
          gemini_api_key: claude ? (settings?.gemini_api_key ?? null) : null,
          anthropic_api_key: claude ? null : (settings?.anthropic_api_key ?? null),
          anthropic_key_saved_at: claude ? null : (settings?.anthropic_key_saved_at ?? null),
          model: settings?.model ?? null,
        };
        if (isClaudeModel(next.model) === claude) {
          next.model = claude ? (next.gemini_api_key ? FALLBACK_MODEL : null) : next.anthropic_api_key ? CLAUDE_DEFAULT_MODEL : null;
        }
        const { error } =
          next.gemini_api_key || next.anthropic_api_key
            ? await db.from('ai_settings').update({ ...next, updated_at: new Date().toISOString() }).eq('user_id', user.id)
            : await db.from('ai_settings').delete().eq('user_id', user.id);
        if (error) throw error;
        return json(await statusOf(next.gemini_api_key || next.anthropic_api_key ? next : null));
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
        if (!settings?.model || !(settings.gemini_api_key || settings.anthropic_api_key)) {
          return json({ error: 'API キーを登録してください' }, 400);
        }
        const messages = (body.messages ?? []) as { role: 'user' | 'model'; text: string }[];
        const system = String(body.system ?? '');
        // 選んだモデル → 同じ会社の軽いモデル → もう一方の会社の順に試す（candidatesFor）。
        // 混み合い（503・529 など）は少し待って送り直し、使えないモデル（404）はすぐ次へ
        const candidates = candidatesFor(settings, settings.model);
        const { out, model } = await generateAny(settings, candidates, system, messages);
        // 選んでいたモデルが使えなくなっていたら（404）、答えたモデルを設定にする（混み合いで切り替えただけなら変えない）
        if (model !== settings.model) {
          const first = candidates.indexOf(settings.model);
          if (first === 0) {
            try {
              // 選んだモデルが 404 だったかは、もう一度は試さずに一覧で確かめる
              const available = (await statusOf(settings)).models.some((m) => m.id === settings.model);
              if (!available) {
                await db.from('ai_settings').update({ model, updated_at: new Date().toISOString() }).eq('user_id', user.id);
              }
            } catch {
              // 確かめられなければ設定は変えない
            }
          }
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
      case 'extract': {
        // 明細の写真・CSV などから記録を読み取る（AI入力）。返事は JSON の配列
        if (!settings?.model || !(settings.gemini_api_key || settings.anthropic_api_key)) {
          return json({ error: 'API キーを登録してください' }, 400);
        }
        // AI入力は1回に10件まで（アプリの useAttachments の MAX_FILES と同じ）
        const files = ((body.files ?? []) as { mimeType: string; data: string }[]).slice(0, 10);
        const text = String(body.text ?? '').slice(0, 200_000);
        const system = String(body.system ?? '');
        const { out, model: used } = await generateAny(
          settings,
          candidatesFor(settings, settings.model),
          system,
          [{ role: 'user', text: text || '添付の内容から記録を読み取ってください。', files }],
          true,
        );
        const raw = (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        await db.from('ai_usage').insert({
          user_id: user.id,
          model: used,
          prompt_tokens: out.usageMetadata?.promptTokenCount ?? 0,
          output_tokens: out.usageMetadata?.candidatesTokenCount ?? 0,
        });
        let records: unknown = [];
        try {
          const parsed = JSON.parse(raw);
          records = Array.isArray(parsed) ? parsed : (parsed?.records ?? []);
        } catch {
          return json({ error: '読み取れませんでした。写真をはっきり撮り直すか、別のファイルで試してください' }, 422);
        }
        return json({ records });
      }
      case 'title': {
        // 会話の中身から短いタイトルを作る。無料枠を節約するため軽いモデルで、混み合っていたら Flash に切り替える
        if (!settings?.gemini_api_key && !settings?.anthropic_api_key) {
          return json({ error: 'API キーを登録してください' }, 400);
        }
        const messages = (body.messages ?? []) as { role: 'user' | 'model'; text: string }[];
        const transcript = messages.map((m) => `${m.role === 'user' ? '質問' : '答え'}: ${m.text}`).join('\n').slice(0, 4000);
        // 付け直しのときは今のタイトルを渡し、話題が大きく変わっていなければそのまま返してもらう
        const currentTitle = typeof body.currentTitle === 'string' ? body.currentTitle.slice(0, 60) : '';
        const system =
          '次の家計相談の会話に、内容が分かる日本語のタイトルを付けてください。20文字以内、記号や引用符なし、タイトルだけを1行で返す。「相手A」「内容1」のような名前はそのまま使う。' +
          (currentTitle
            ? `今のタイトルは「${currentTitle}」です。会話の話題が大きく変わっていなければ、今のタイトルを一字も変えずにそのまま返す。`
            : '');
        // 無料の Gemini の軽いモデルを先に。なければ・混み合っていれば Claude の Haiku
        const { out } = await generateAny(
          settings,
          candidatesFor(settings, settings.gemini_api_key ? LIGHT_FALLBACK_MODEL : CLAUDE_DEFAULT_MODEL),
          system,
          [{ role: 'user', text: transcript }],
        );
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
      const name = e instanceof ClaudeError ? 'Claude' : 'Gemini';
      const temporary = e instanceof ClaudeError ? isClaudeTemporary(e.status) : isTemporary(e.status);
      const message =
        e.status === 429
          ? `${name} の利用の上限に達しました。しばらく待ってから送ってください`
          : temporary
            ? `${name} が混み合っています。少し待ってから送ってください`
            : e.status === 404
              ? 'このモデルは使えなくなりました。設定でほかのモデルを選んでください'
              : e instanceof ClaudeError && (e.status === 401 || e.status === 403)
                ? 'Claude に断られました。API キーの期限が切れていないか、設定で確かめてください'
                : e.status === 400 || e.status === 401 || e.status === 403
                  ? `${name} に断られました。API キーやモデルを確かめてください`
                  : `${name} につながりませんでした（${e.status}）`;
      // アプリは 500〜504 を「混み合い」として送り直すので、Claude の 529 は 503 として返す
      return json({ error: message, status: temporary ? 503 : e.status }, 502);
    }
    return json({ error: '処理できませんでした' }, 500);
  }
});
