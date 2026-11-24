import { ASSET_KINDS, type AccountKind } from './accountKinds';

type BalanceRef = { id: string; kind: AccountKind; isArchived: boolean; balance: number };

/** 前に知らせた口座と残高（口座の id → 残高） */
export type NotifiedNegatives = Record<string, number>;

/**
 * マイナスにならないはずの口座（現金・銀行・電子マネー・投資）の今の残高がマイナスなら、残高がずれている
 * （2026-11-24 改善要望）。前に同じ残高で知らせた口座は知らせない。0 以上に戻った口座は覚えから外す
 */
export function negativeToNotify<T extends BalanceRef>(
  balances: readonly T[],
  notified: NotifiedNegatives,
): { notify: T[]; next: NotifiedNegatives } {
  const negative = balances.filter((b) => !b.isArchived && ASSET_KINDS.includes(b.kind) && b.balance < 0);
  return {
    notify: negative.filter((b) => notified[b.id] !== b.balance),
    next: Object.fromEntries(negative.map((b) => [b.id, b.balance])),
  };
}
