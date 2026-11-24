import { ASSET_KINDS, type AccountKind } from './accountKinds';

type AccountRef = { id: string; kind: AccountKind; is_archived: boolean };
type TransactionRef = { from_account_id: string | null; to_account_id: string | null };

/**
 * 貸し借りの相手の残高を 0 にする振替（2026-11-24 改善要望: 返ってこない端数をなしにする・多く返してもらった分を
 * 自分の口座のお金にする）。相手から出る向きにすると相手の残高が減るので、残高がプラスなら 相手 → 自分の口座、
 * マイナスなら 自分の口座 → 相手。自分の口座は、その相手との記録でいちばん多く使った資産の口座
 * （同じ数なら新しい記録のほう。transactions は新しい順）。なければ最初の現金の口座
 */
export function settleTransfer(
  personId: string,
  balance: number,
  transactions: readonly TransactionRef[],
  accounts: readonly AccountRef[],
): { from: string; to: string; amount: number } | null {
  if (balance === 0) return null;
  const usable = new Map(
    accounts.filter((a) => !a.is_archived && ASSET_KINDS.includes(a.kind)).map((a) => [a.id, a] as const),
  );
  const counts = new Map<string, number>();
  for (const t of transactions) {
    const other = t.from_account_id === personId ? t.to_account_id : t.to_account_id === personId ? t.from_account_id : null;
    if (other && usable.has(other)) counts.set(other, (counts.get(other) ?? 0) + 1);
  }
  // Map は最初に入れた順（新しい記録の順）なので、同じ数なら新しいほうが残る
  let counter: string | null = null;
  let best = 0;
  for (const [id, n] of counts) {
    if (n > best) {
      counter = id;
      best = n;
    }
  }
  counter ??= [...usable.values()].find((a) => a.kind === 'cash')?.id ?? null;
  if (!counter) return null;
  return balance > 0
    ? { from: personId, to: counter, amount: balance }
    : { from: counter, to: personId, amount: -balance };
}
