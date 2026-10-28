type Movement = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

/** 1件の記録が、対象の口座の残高の合計をいくら動かすか（対象の口座どうしの移動は 0） */
export function effectOn(m: Movement, isTarget: (accountId: string) => boolean): number {
  return (
    (m.to_account_id && isTarget(m.to_account_id) ? m.amount : 0) -
    (m.from_account_id && isTarget(m.from_account_id) ? m.amount : 0)
  );
}

/** 対象の口座の残高に対する、after より後〜through まで（through を含む）の記録の増減 */
export function plannedEffect(
  movements: readonly Movement[],
  isTarget: (accountId: string) => boolean,
  after: string,
  through: string,
): number {
  let effect = 0;
  for (const m of movements) {
    if (m.date > after && m.date <= through) effect += effectOn(m, isTarget);
  }
  return effect;
}
