/**
 * 入力中の文字を含む、過去の内容の候補（よく使う順、同数なら新しい順）。
 * history は新しい順の内容。入力と同じものと、入力が空のときは出さない。
 */
export function suggestPayees(history: readonly string[], input: string, limit = 5): string[] {
  const term = input.trim().toLowerCase();
  if (term === '') return [];
  const counts = new Map<string, { count: number; order: number }>();
  history.forEach((payee, order) => {
    const found = counts.get(payee);
    if (found) found.count += 1;
    else counts.set(payee, { count: 1, order });
  });
  return [...counts.entries()]
    .filter(([payee]) => payee.toLowerCase().includes(term) && payee.trim().toLowerCase() !== term)
    .sort(([, a], [, b]) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map(([payee]) => payee);
}
