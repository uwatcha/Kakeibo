import { ASSET_KINDS, type AccountKind } from './accountKinds';

export type AccountBalance = {
  id: string;
  name: string;
  kind: AccountKind;
  isReserved: boolean;
  isArchived: boolean;
  sortOrder: number;
  /** 負債はマイナス */
  balance: number;
};

export type BalanceSummary = {
  /** 全口座（非表示も含む）の残高合計 */
  netWorth: number;
  /** 汎用資産: 純資産から普段使わない口座（REQ-14）を除いた額。ホームでいちばん大きく出す */
  availableNetWorth: number;
  /** 普段使う口座（現金・銀行・電子マネー・投資） */
  everyday: AccountBalance[];
  everydayTotal: number;
  /** 普段使わない口座（REQ-14）。ホームでは折りたたんで表示する */
  reserved: AccountBalance[];
  reservedTotal: number;
  creditCards: AccountBalance[];
  /** クレカの未払い額（正の値） */
  creditCardUnpaid: number;
  receivables: AccountBalance[];
  /** 貸している・立て替えている額（正の値） */
  receivableTotal: number;
  payables: AccountBalance[];
  /** 借りている額（正の値） */
  payableTotal: number;
};

const sum = (accounts: AccountBalance[]) => accounts.reduce((total, a) => total + a.balance, 0);
// -0 を「-0円」と表示しないよう 0 - x で反転する
const negate = (value: number) => 0 - value;

/** ホーム画面に出す残高のまとめ。非表示の口座は一覧に出さないが、純資産には含める */
export function summarizeBalances(accounts: AccountBalance[]): BalanceSummary {
  const visible = accounts
    .filter((a) => !a.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja'));
  const assets = visible.filter((a) => ASSET_KINDS.includes(a.kind));

  const everyday = assets.filter((a) => !a.isReserved);
  const reserved = assets.filter((a) => a.isReserved);
  const creditCards = visible.filter((a) => a.kind === 'credit_card');
  const receivables = visible.filter((a) => a.kind === 'receivable');
  const payables = visible.filter((a) => a.kind === 'payable');

  return {
    netWorth: sum(accounts),
    // 非表示にした口座も「普段使わない」ものだけ除く（純資産と同じく非表示の口座も含める）
    availableNetWorth: sum(accounts.filter((a) => !(ASSET_KINDS.includes(a.kind) && a.isReserved))),
    everyday,
    everydayTotal: sum(everyday),
    reserved,
    reservedTotal: sum(reserved),
    creditCards,
    creditCardUnpaid: negate(sum(creditCards)),
    receivables,
    receivableTotal: sum(receivables),
    payables,
    payableTotal: negate(sum(payables)),
  };
}
