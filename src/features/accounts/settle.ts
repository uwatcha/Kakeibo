/**
 * 貸し借りの相手の残高を 0 にする残高調整（2026-11-24 改善要望: 返ってこない端数をなしにする・多く返してもらった分を
 * 自分のお金にする）。多く返してもらった分・返ってこない分は、貸し金戻りなどで自分の口座にもう入っている（または
 * 入っていない）ので、自分の口座は動かさず、相手の残高だけを 0 に合わせる（2026-11-24: 最初は自分の口座との振替に
 * していたが、自分の口座の残高が実際とずれた）。残高がプラスなら減らす、マイナスなら増やす
 */
export function settleAdjustment(balance: number): { direction: 'increase' | 'decrease'; amount: number } | null {
  if (balance === 0) return null;
  return balance > 0 ? { direction: 'decrease', amount: balance } : { direction: 'increase', amount: -balance };
}
