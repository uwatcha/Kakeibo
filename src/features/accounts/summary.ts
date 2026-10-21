import { type AccountKind, ASSET_KINDS, canBeReserved, compareAccounts } from './accountKinds';

export type AccountBalance = {
  id: string;
  name: string;
  kind: AccountKind;
  isReserved: boolean;
  /** 振替の提案で使う順番（0 = 使わない、1 以上 = 小さいほど先に使う） */
  transferPriority: number;
  isArchived: boolean;
  /** 負債はマイナス */
  balance: number;
  /** 実質残高に含めるか（右上のつまみのアイコンから切り替える） */
  includeInAvailable: boolean;
};

export type BalanceSummary = {
  /** 全口座（非表示も含む）の残高合計 */
  netWorth: number;
  /** 実質残高: 実質残高に含めると選んだ口座の残高の合計。ホームでいちばん大きく出す */
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

/** 実質残高に数える口座か（口座ごとに選ぶ） */
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

/** 実質残高の内訳: 含める口座のうち、プラスの口座（多い順）とマイナスの口座（マイナスが大きい順）。0 円は出さない */
export function availableBreakdown(accounts: readonly AccountBalance[]): {
  plus: AccountBalance[];
  minus: AccountBalance[];
  plusTotal: number;
  minusTotal: number;
} {
  const included = accounts.filter(isAvailableAccount);
  const plus = included.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
  const minus = included.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);
  return { plus, minus, plusTotal: sum(plus), minusTotal: sum(minus) };
}

/** 振替の提案で振替元にする口座の id（「振替に使う」にした資産の口座を、順番どおりに） */
export function transferOrder(accounts: readonly AccountBalance[]): string[] {
  return accounts
    .filter((a) => ASSET_KINDS.includes(a.kind) && !a.isArchived && a.transferPriority > 0)
    .sort((a, b) => a.transferPriority - b.transferPriority)
    .map((a) => a.id);
}
