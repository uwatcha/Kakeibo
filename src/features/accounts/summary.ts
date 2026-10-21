import { type AccountKind, ASSET_KINDS, canBeReserved, compareAccounts } from './accountKinds';

export type AccountBalance = {
  id: string;
  name: string;
  kind: AccountKind;
  isReserved: boolean;
  /** 振替の提案で使う順（0 = 使わない、1 = 低、2 = 普通、3 = 高） */
  transferPriority: number;
  isArchived: boolean;
  /** 負債はマイナス */
  balance: number;
  /** 汎用資産に含めるか（ホームの ⚙ から切り替える） */
  includeInAvailable: boolean;
};

export type BalanceSummary = {
  /** 全口座（非表示も含む）の残高合計 */
  netWorth: number;
  /** 汎用資産: 汎用資産に含めると選んだ口座の残高の合計。ホームでいちばん大きく出す */
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

/** 汎用資産に数える口座か（口座ごとに選ぶ） */
export function isAvailableAccount(account: Pick<AccountBalance, 'includeInAvailable'>): boolean {
  return account.includeInAvailable;
}

const sum = (accounts: AccountBalance[]) => accounts.reduce((total, a) => total + a.balance, 0);
// -0 を「-0円」と表示しないよう 0 - x で反転する
const negate = (value: number) => 0 - value;

/** ホーム画面に出す残高のまとめ。非表示の口座は一覧に出さないが、純資産には含める */
export function summarizeBalances(accounts: AccountBalance[]): BalanceSummary {
  const visible = accounts.filter((a) => !a.isArchived).sort(compareAccounts);
  const assets = visible.filter((a) => ASSET_KINDS.includes(a.kind));

  const everyday = assets.filter((a) => !a.isReserved);
  // 普段使わない資産と貸し借りの相手は、ホームの下の「普段使わない口座」にまとめる
  const reserved = visible.filter((a) => a.isReserved && canBeReserved(a.kind));
  const creditCards = visible.filter((a) => a.kind === 'credit_card');
  const receivables = visible.filter((a) => a.kind === 'receivable' && !a.isReserved);
  const payables = visible.filter((a) => a.kind === 'payable' && !a.isReserved);

  return {
    netWorth: sum(accounts),
    availableNetWorth: sum(accounts.filter(isAvailableAccount)),
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
