import type { AiMessage } from './api';

/** 1回に AI に送る画像の数（新しいものから。古い画像は「画像あり」の印だけにして、送る量を抑える） */
export const MAX_SENT_IMAGES = 8;
/** 1つの質問に添えられる画像の数 */
export const MAX_IMAGES_PER_MESSAGE = 4;

type HistoryItem = { role: 'user' | 'model'; sent: string; images?: string[] | null };

/** 会話を AI に送る形にする。画像は新しいほうから MAX_SENT_IMAGES 枚まで付け、それより古い画像は文に印だけ残す */
export function toAiMessages(history: readonly HistoryItem[]): AiMessage[] {
  let left = MAX_SENT_IMAGES;
  const out: AiMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const images = m.images ?? [];
    const sent = images.slice(0, Math.max(0, left));
    left -= sent.length;
    const dropped = images.length - sent.length;
    const text = dropped > 0 ? `${m.sent}\n（ほかに画像が${dropped}枚ありましたが、古いので省きました）` : m.sent;
    out.unshift({
      role: m.role,
      text,
      ...(sent.length > 0 && { files: sent.map((data) => ({ mimeType: 'image/jpeg', data })) }),
    });
  }
  return out;
}
