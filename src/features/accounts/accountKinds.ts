import type { Database } from '@/types/database';

export type AccountKind = Database['public']['Enums']['account_kind'];

type AccountKindInfo = {
  label: string;
  icon: string;
  /** 初期残高の入力欄の見出し */
  openingBalanceLabel: string;
};

export const ACCOUNT_KIND_INFO: Record<AccountKind, AccountKindInfo> = {
  cash: { label: '現金', icon: 'wallet', openingBalanceLabel: '今の残高' },
  bank: { label: '銀行', icon: 'bank', openingBalanceLabel: '今の残高' },
  emoney: { label: '電子マネー', icon: 'cellphone-nfc', openingBalanceLabel: '今の残高' },
  investment: { label: '投資', icon: 'chart-line', openingBalanceLabel: '今の評価額' },
  credit_card: { label: 'クレジットカード', icon: 'credit-card', openingBalanceLabel: '今の未払い額' },
  payable: { label: '借りている相手', icon: 'account-arrow-left', openingBalanceLabel: '今借りている額' },
  receivable: { label: '貸している相手', icon: 'account-arrow-right', openingBalanceLabel: '今貸している額' },
};

export const ACCOUNT_KINDS = Object.keys(ACCOUNT_KIND_INFO) as AccountKind[];

/** 自分のお金を置いておく口座（現金・銀行・電子マネー・投資） */
export const ASSET_KINDS: readonly AccountKind[] = ['cash', 'bank', 'emoney', 'investment'];

/** 残高がマイナスになる口座（クレカ・借金） */
export function isLiability(kind: AccountKind): boolean {
  return kind === 'credit_card' || kind === 'payable';
}

/** 画面で入力した正の金額を、DB に保存する初期残高（負債はマイナス）にする */
export function toOpeningBalance(kind: AccountKind, inputAmount: number): number {
  return isLiability(kind) ? 0 - inputAmount : inputAmount;
}

/** DB の初期残高を、画面に表示する正の金額にする */
export function fromOpeningBalance(kind: AccountKind, openingBalance: number): number {
  return isLiability(kind) ? 0 - openingBalance : openingBalance;
}
