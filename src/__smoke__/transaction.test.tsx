// 記録の入力画面を、記録の種類ごとに描いてみる（アプリと同じく React Compiler を通す。jest.config.js）。
// 2026-10-23 に、描画の時点で落ちる不具合が実機でだけ起きたため
/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock は import より先に置く */
import { renderAndCheck } from './helpers';

const mockParams = { current: { id: 'new' } as Record<string, string> };
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => undefined,
}));
jest.mock('expo-router', () => {
  const Stack = function Stack() {
    return null;
  };
  Stack.Screen = function Screen() {
    return null;
  };
  return { router: { push: jest.fn(), back: jest.fn() }, Stack, useLocalSearchParams: () => mockParams.current };
});
const mockAccounts = [
  { id: 'bank', name: 'サンプル銀行', kind: 'bank', is_archived: false, is_reserved: false, default_category_id: null },
  { id: 'card', name: 'サンプルカード', kind: 'credit_card', is_archived: false, is_reserved: false, default_category_id: null },
  { id: 'friend', name: '友達', kind: 'receivable', is_archived: false, is_reserved: false, default_category_id: null },
];
const mockCategories = [
  { id: 'food', name: '食費', kind: 'expense', parent_id: null, is_archived: false, sort_order: 0 },
  { id: 'eat', name: '外食', kind: 'expense', parent_id: 'food', is_archived: false, sort_order: 0 },
  { id: 'salary', name: '給与・アルバイト', kind: 'income', parent_id: null, is_archived: false, sort_order: 0 },
];
const mockTxn = { current: undefined as unknown };
const mockQ = (data: unknown) => ({ data, error: null, refetch: jest.fn(), isLoading: false });
const mockM = () => ({ mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false, isError: false, reset: jest.fn() });
jest.mock('@/features/accounts/hooks', () => ({
  useAccounts: () => mockQ(mockAccounts),
  useBalanceMap: () => new Map([['bank', 1000]]),
  useCreateAccount: () => mockM(),
}));
jest.mock('@/features/categories/hooks', () => ({ useCategories: () => mockQ(mockCategories) }));
jest.mock('@/features/employers/hooks', () => ({
  useEmployers: () => mockQ([{ id: 'e', name: '大学', is_archived: false }]),
}));
jest.mock('@/features/transactions/hooks', () => ({
  useTransaction: () => mockQ(mockTxn.current),
  useCreateTransaction: () => mockM(),
  useUpdateTransaction: () => mockM(),
  useDeleteTransaction: () => mockM(),
  usePayeeHistory: () => mockQ(['コンビニ']),
  useExpensesAround: () => mockQ([]),
  useAdvancesFor: () => mockQ([]),
}));

import TransactionEditScreen from '@/app/transaction/[id]';

const base = {
  id: 't1',
  amount: 1200,
  date: '2026-10-20',
  payee: 'ラーメン',
  memo: null,
  category_id: 'eat',
  from_account_id: 'card',
  to_account_id: null,
  list_price: null,
  points_used: null,
  employer_id: null,
  related_transaction_id: null,
  recurring_rule_id: null,
  is_confirmed: true,
  auto_source: 'email',
  auto_reviewed: false,
  needs_payee: false,
  raw_payee: 'ラーメン',
  auto_salary: false,
};

describe('記録の入力画面', () => {
  it('新規', async () => {
    mockParams.current = { id: 'new' };
    mockTxn.current = undefined;
    expect(await renderAndCheck(<TransactionEditScreen />)).toEqual([]);
  });

  it.each([
    ['支払い', { type: 'expense' }],
    [
      '収入（給与）',
      { type: 'income', category_id: 'salary', from_account_id: null, to_account_id: 'bank', employer_id: 'e' },
    ],
    ['振替', { type: 'transfer', category_id: null, to_account_id: 'bank' }],
    ['立て替え', { type: 'advance', category_id: null, to_account_id: 'friend' }],
    ['残高調整', { type: 'adjustment', category_id: null, from_account_id: null, to_account_id: 'bank' }],
    [
      '未確認・ポイントあり',
      { type: 'expense', date: '2026-10-01', is_confirmed: false, list_price: 1500, points_used: 300 },
    ],
  ])('編集: %s', async (_, values) => {
    mockParams.current = { id: 't1' };
    mockTxn.current = { ...base, ...values };
    expect(await renderAndCheck(<TransactionEditScreen />)).toEqual([]);
  });
});
