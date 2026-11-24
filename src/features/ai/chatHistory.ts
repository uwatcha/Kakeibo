import { type Aliases, maskText } from './anonymize';
import type { AiMessage } from './api';

/**
 * 前の質問の画像を AI に送る数（新しいものから。古い画像は「画像あり」の印だけにして、送る量を抑える）。
 * 今送る質問の画像は、枚数にかかわらず全部送る（添える枚数の上限はない。2026-11-24 ユーザーの指定）
 */
export const MAX_SENT_IMAGES = 8;

type HistoryItem = { role: 'user' | 'model'; sent: string; images?: string[] | null };

/** 会話を AI に送る形にする。最後の質問の画像は全部、それより前は新しいほうから MAX_SENT_IMAGES 枚まで付け、古い画像は文に印だけ残す */
export function toAiMessages(history: readonly HistoryItem[]): AiMessage[] {
  let left = MAX_SENT_IMAGES;
  const out: AiMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const images = m.images ?? [];
    const isLast = i === history.length - 1;
    const sent = isLast ? images : images.slice(0, Math.max(0, left));
    if (!isLast) left -= sent.length;
    const dropped = images.length - sent.length;
    const text =
      dropped > 0
        ? `${m.sent}\n（ほかに画像が${dropped}枚ありましたが、古いので省きました。その中身は今は見えません）`
        : m.sent;
    out.unshift({
      role: m.role,
      text,
      ...(sent.length > 0 && { files: sent.map((data) => ({ mimeType: 'image/jpeg', data })) }),
    });
  }
  return out;
}

/**
 * 前のやりとりを、今の置き換えで置き換え直す（保存した sent ではなく、元の名前の shown から）。
 * 置き換えの名前は送るたびに今の口座・記録から作り直すので、保存した sent のままだと、前のやりとりと今の材料で
 * 同じ口座が別の名前になることがある（2026-11-24。PayPay の記録を Suica のものと読んだ）
 */
export function remaskHistory<T extends HistoryItem & { shown: string }>(
  history: readonly T[],
  aliases: Pick<Aliases, 'toAlias'>,
): T[] {
  return history.map((m) => ({ ...m, sent: maskText(m.shown, aliases) }));
}
