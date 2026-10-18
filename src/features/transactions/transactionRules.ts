import { ASSET_KINDS, type AccountKind } from '@/features/accounts/accountKinds';
import type { Database } from '@/types/database';

export type TransactionType = Database['public']['Enums']['txn_type'];
export type CategoryKind = Database['public']['Enums']['category_kind'];

type Side = {
  label: string;
  kinds: readonly AccountKind[];
};

export type TransactionRule = {
  label: string;
  icon: string;
  /** 出金元。null ならこの種類では使わない */
  from: Side | null;
  /** 入金先。null ならこの種類では使わない */
  to: Side | null;
  /** カテゴリを付けられる種類（支払い・収入のみ） */
  categoryKind: CategoryKind | null;
};

const ASSETS_AND_CARD: readonly AccountKind[] = [...ASSET_KINDS, 'credit_card'];

// 口座の種類との組み合わせはここで守る。DB の CHECK 制約は from / to の有無だけを守る（設計書 3章）
export const TRANSACTION_RULES: Record<TransactionType, TransactionRule> = {
  expense: {
    label: '支払い',
    icon: 'cart',
    from: { label: '支払い元', kinds: ASSETS_AND_CARD },
    to: null,
    categoryKind: 'expense',
  },
  income: {
    label: '収入',
    icon: 'cash-plus',
    from: null,
    to: { label: '入金先', kinds: ASSET_KINDS },
    categoryKind: 'income',
  },
  transfer: {
    label: '振替',
    icon: 'swap-horizontal',
    from: { label: '出金元', kinds: ASSET_KINDS },
    // クレカへの振替 = 引き落とし（REQ-33）
    to: { label: '入金先', kinds: ASSETS_AND_CARD },
    categoryKind: null,
  },
  advance: {
    label: '立て替え',
    icon: 'account-cash',
    // 割り勘をクレカで払ったときの相手の分も記録できるよう、クレカも出金元にできる
    from: { label: '支払い元', kinds: ASSETS_AND_CARD },
    to: { label: '立て替えた相手', kinds: ['receivable'] },
    categoryKind: null,
  },
  lend: {
    label: '金貸し',
    icon: 'hand-coin',
    from: { label: '出金元', kinds: ASSET_KINDS },
    to: { label: '貸した相手', kinds: ['receivable'] },
    categoryKind: null,
  },
  collect: {
    label: '貸し金戻り',
    icon: 'cash-refund',
    from: { label: '返してくれた相手', kinds: ['receivable'] },
    to: { label: '入金先', kinds: ASSET_KINDS },
    categoryKind: null,
  },
  borrow: {
    label: '借金',
    icon: 'account-arrow-left',
    from: { label: '借りた相手', kinds: ['payable'] },
    to: { label: '入金先', kinds: ASSET_KINDS },
    categoryKind: null,
  },
  repay: {
    label: '返済',
    icon: 'account-arrow-right',
    from: { label: '出金元', kinds: ASSET_KINDS },
    to: { label: '返した相手', kinds: ['payable'] },
    categoryKind: null,
  },
  adjustment: {
    label: '残高調整',
    icon: 'scale-balance',
    // 実際には from / to のどちらか片方だけを使う（adjustmentDirection で決める）
    from: { label: '口座', kinds: [...ASSETS_AND_CARD, 'payable', 'receivable'] },
    to: { label: '口座', kinds: [...ASSETS_AND_CARD, 'payable', 'receivable'] },
    categoryKind: null,
  },
};

/** 入力画面で直接選べる種類。残りは「その他」から選ぶ */
export const PRIMARY_TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];
export const OTHER_TYPES: readonly TransactionType[] = ['advance', 'lend', 'collect', 'borrow', 'repay', 'adjustment'];

/** 月の収支集計に入る種類（REQ-34） */
export function countsInSummary(type: TransactionType): boolean {
  return type === 'expense' || type === 'income';
}

export type AdjustmentDirection = 'increase' | 'decrease';

export type TransactionDraft = {
  type: TransactionType;
  amount: number | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  /** 残高調整のときだけ使う。increase なら to、decrease なら from に口座を入れる */
  adjustmentDirection: AdjustmentDirection;
  categoryId: string | null;
  date: string;
};

type AccountRef = { id: string; kind: AccountKind };
type CategoryRef = { id: string; kind: CategoryKind };

export type DraftErrors = Partial<Record<'amount' | 'fromAccountId' | 'toAccountId' | 'categoryId' | 'date', string>>;

/** 記録の種類ごとのルールで入力を確かめる。問題がなければ空のオブジェクト */
export function validateDraft(
  draft: TransactionDraft,
  accounts: readonly AccountRef[],
  categories: readonly CategoryRef[],
): DraftErrors {
  const errors: DraftErrors = {};
  const rule = TRANSACTION_RULES[draft.type];
  const kindOf = (id: string | null) => accounts.find((a) => a.id === id)?.kind;

  if (draft.amount === null || !Number.isSafeInteger(draft.amount) || draft.amount <= 0) {
    errors.amount = '1円以上の金額を入力してください';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.date = '日付を選んでください';
  }

  const { fromAccountId, toAccountId } = normalizeAccounts(draft);
  const checkSide = (key: 'fromAccountId' | 'toAccountId', side: Side | null, id: string | null) => {
    if (!side) return;
    if (!id) {
      errors[key] = `${side.label}を選んでください`;
      return;
    }
    const kind = kindOf(id);
    if (!kind || !side.kinds.includes(kind)) errors[key] = `${side.label}にはこの口座を選べません`;
  };

  if (draft.type === 'adjustment') {
    // 画面では口座欄が1つなので、エラーは fromAccountId に出す
    checkSide('fromAccountId', rule.from, fromAccountId ?? toAccountId);
  } else {
    checkSide('fromAccountId', rule.from, fromAccountId);
    checkSide('toAccountId', rule.to, toAccountId);
    if (fromAccountId && fromAccountId === toAccountId) {
      errors.toAccountId = '出金元と同じ口座は選べません';
    }
  }

  if (draft.categoryId) {
    const category = categories.find((c) => c.id === draft.categoryId);
    if (!rule.categoryKind || !category || category.kind !== rule.categoryKind) {
      errors.categoryId = 'このカテゴリは選べません';
    }
  }
  return errors;
}

/** 種類に合わない側の口座を外す（種類を切り替えたときに前の選択が残らないように） */
export function normalizeAccounts(draft: TransactionDraft): {
  fromAccountId: string | null;
  toAccountId: string | null;
} {
  const rule = TRANSACTION_RULES[draft.type];
  if (draft.type === 'adjustment') {
    const account = draft.fromAccountId ?? draft.toAccountId;
    return draft.adjustmentDirection === 'increase'
      ? { fromAccountId: null, toAccountId: account }
      : { fromAccountId: account, toAccountId: null };
  }
  return {
    fromAccountId: rule.from ? draft.fromAccountId : null,
    toAccountId: rule.to ? draft.toAccountId : null,
  };
}

/** 残高に対する向き。一覧で金額に付ける符号に使う（支出は -、収入は +、それ以外は付けない） */
export function amountSign(type: TransactionType): '-' | '+' | '' {
  if (type === 'expense') return '-';
  if (type === 'income') return '+';
  return '';
}
