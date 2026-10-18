/** 過去の記録で同じ内容に付けたカテゴリのうち、いちばん多いもの（同数なら新しい方）。なければ null */
export function guessCategory(history: readonly { category_id: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const h of history) {
    if (h.category_id) counts.set(h.category_id, (counts.get(h.category_id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  // history は新しい順なので、同数なら先に出てきた（新しい）方を残す
  for (const h of history) {
    if (!h.category_id) continue;
    const count = counts.get(h.category_id)!;
    if (count > bestCount) {
      best = h.category_id;
      bestCount = count;
    }
  }
  return best;
}
