// Gemini の呼び出し（ai-chat と email-import で使う）

export const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/** 新しい API キー（sb_secret_...）と従来の service_role のどちらでも動くようにする */
export function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const first = Object.values(keys)[0];
  if (!first) throw new Error('service key not found');
  return first;
}

/** 送る1通。files は写真・PDF などのファイル（base64） */
export type Message = { role: string; text: string; files?: { mimeType: string; data: string }[] };

export async function generate(apiKey: string, model: string, system: string, messages: Message[], asJson = false) {
  const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role,
        parts: [
          ...(m.files ?? []).map((f) => ({ inline_data: { mime_type: f.mimeType, data: f.data } })),
          { text: m.text },
        ],
      })),
      ...(asJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    }),
  });
  if (!res.ok) throw new GeminiError(res.status, await res.text());
  return (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
}

/**
 * 最初に選ぶモデル・使えなくなったときの切り替え先: 常に最新の Flash を指す gemini-flash-latest を優先。
 * 古い版は一覧に出ていても新しい利用者には使えない（404）ことがあるため
 */
export const FALLBACK_MODEL = 'gemini-flash-latest';
/** Flash も混み合っているときに試す、軽いモデル */
export const LIGHT_FALLBACK_MODEL = 'gemini-flash-lite-latest';

/** 混み合い・一時的な障害（少し待てば通ることがある） */
export const isTemporary = (status: number) => status === 500 || status === 502 || status === 503 || status === 504;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 一時的なエラーなら 1秒・3秒待って、最大2回送り直す */
export async function generateWithRetry(apiKey: string, model: string, system: string, messages: Message[], asJson = false) {
  for (const wait of [1000, 3000, 0]) {
    try {
      return await generate(apiKey, model, system, messages, asJson);
    } catch (e) {
      if (!(e instanceof GeminiError) || !isTemporary(e.status) || wait === 0) throw e;
      await sleep(wait);
    }
  }
  throw new Error('unreachable');
}

export class GeminiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Gemini ${status}`);
  }

}
