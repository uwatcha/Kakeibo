// Claude（Anthropic）の呼び出し（ai-chat で使う）。返事は Gemini と同じ形にそろえて返すので、呼ぶ側は分けずに扱える
import { GeminiError, type Message, sleep } from './gemini.ts';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

/** 選べる Claude のモデル（新しい順）。Haiku は安く速い、Sonnet は賢いが高い */
export const CLAUDE_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', inputTokenLimit: 200_000 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', inputTokenLimit: 200_000 },
];
export const CLAUDE_DEFAULT_MODEL = 'claude-haiku-5-5';

/** Claude からのエラー（GeminiError と同じく status を持つ。どちらで失敗したかを知らせるために分ける） */
export class ClaudeError extends GeminiError {}

export const isClaudeModel = (model: string | null | undefined) => !!model && model.startsWith('claude-');

/** Claude の混み合い（529 overloaded）も、Gemini の 503 と同じく一時的なものとして扱う */
export const isClaudeTemporary = (status: number) => status === 529 || (status >= 500 && status <= 504);

type ClaudeBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

/** 会話を Claude の形に（model → assistant。同じ役が続いたらまとめ、最初は user にする） */
function toClaudeMessages(messages: Message[]) {
  const out: { role: 'user' | 'assistant'; content: ClaudeBlock[] }[] = [];
  for (const m of messages) {
    const role = m.role === 'model' ? 'assistant' : 'user';
    const blocks: ClaudeBlock[] = [
      ...(m.files ?? []).map((f): ClaudeBlock =>
        f.mimeType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: f.mimeType, data: f.data } }
          : { type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.data } },
      ),
      { type: 'text', text: m.text || '…' },
    ];
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  }
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: [{ type: 'text', text: '…' }] });
  return out;
}

/** ```json … ``` で囲まれて返ってきたら中身だけにする */
const unfence = (text: string) => text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

export async function generateClaude(
  apiKey: string,
  model: string,
  system: string,
  messages: Message[],
  asJson = false,
  maxTokens = 4096,
) {
  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: asJson ? `${system}\n\n返事は JSON だけを返す（前後に説明や \`\`\` を付けない）。` : system,
      messages: toClaudeMessages(messages),
    }),
  });
  if (!res.ok) throw new ClaudeError(res.status, await res.text());
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (body.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join('');
  const prompt = body.usage?.input_tokens ?? 0;
  const output = body.usage?.output_tokens ?? 0;
  return {
    candidates: [{ content: { parts: [{ text: asJson ? unfence(text) : text }] } }],
    usageMetadata: { promptTokenCount: prompt, candidatesTokenCount: output, totalTokenCount: prompt + output },
  };
}

/** 一時的なエラーなら 1秒・3秒待って、最大2回送り直す */
export async function generateClaudeWithRetry(
  apiKey: string,
  model: string,
  system: string,
  messages: Message[],
  asJson = false,
) {
  for (const wait of [1000, 3000, 0]) {
    try {
      return await generateClaude(apiKey, model, system, messages, asJson);
    } catch (e) {
      if (!(e instanceof GeminiError) || !isClaudeTemporary(e.status) || wait === 0) throw e;
      await sleep(wait);
    }
  }
  throw new Error('unreachable');
}

/** キーが使えるか、ごく短い1回の呼び出しで確かめる */
export async function checkClaudeKey(apiKey: string): Promise<void> {
  await generateClaude(apiKey, CLAUDE_DEFAULT_MODEL, '', [{ role: 'user', text: 'hi' }], false, 1);
}
