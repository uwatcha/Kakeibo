// カテゴリ・口座の編集画面（ほかのカテゴリへ移す・使われていなければ削除）を描いてみる（React Compiler を通す。jest.config.js）
/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock は import より先に置く */
import { renderAndCheck } from './helpers';

const mockParams = { current: { id: 'eat' } as Record<string, string> };
const mockUsage = { current: { transactions: 3, rules: 1, children: 0, employers: 0, cards: 0 } };
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-reorderable-list', () => ({
  __esModule: true,
  default: function ReorderableList() {
    return null;
  },
  reorderItems: (list: unknown[]) => list,
  useReorderableDrag: () => () => undefined,
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => {
  const Stack = function Stack() {
    return null;
  };
  Stack.Screen = function Screen() {
    return null;
  };
  return { router: { push: jest.fn(), back: jest.fn() }, Stack, useLocalSearchParams: () => mockParams.current };
});
const mockQ = (data: unknown) => ({ data, error: null, refetch: jest.fn(), isLoading: false });
const mockM = () => ({ mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false, isError: false, reset: jest.fn() });
const mockCategories = [
  { id: 'food', name: '食費', kind: 'expense', parent_id: null, is_archived: false, sort_order: 0 },
  { id: 'eat', name: '外食', kind: 'expense', parent_id: 'food', is_archived: false, sort_order: 0 },
];
const mockCategoryList = mockQ(mockCategories);
jest.mock('@/features/categories/hooks', () => ({
  useCategories: () => mockCategoryList,
  useCategoryUsage: () => mockQ(mockUsage.current),
  useCreateCategory: () => mockM(),
  useUpdateCategory: () => mockM(),
  useReorderCategories: () => mockM(),
  useMoveCategoryRecords: () => mockM(),
  useDeleteUnusedCategory: () => mockM(),
}));
// 読み込みの結果は、React Query と同じく毎回同じものを返す（違うものを返すと、フォームを入れ直し続ける）
const mockAccount = mockQ({
  id: 'bank',
  name: 'サンプル銀行',
  kind: 'bank',
  is_archived: false,
  is_reserved: false,
  default_category_id: null,
  memo: null,
  transfer_priority: 1,
});
const mockBalance = mockQ(1000);
const mockAccountList = mockQ([]);
jest.mock('@/features/accounts/hooks', () => ({
  useAccount: () => mockAccount,
  useAccountBalance: () => mockBalance,
  useAccounts: () => mockAccountList,
  useCreateAccount: () => mockM(),
  useUpdateAccount: () => mockM(),
  useAccountUsage: () => mockQ(mockUsage.current),
  useDeleteUnusedAccount: () => mockM(),
}));
jest.mock('@/features/transactions/hooks', () => ({ useCreateTransaction: () => mockM() }));

import AccountEditScreen from '@/app/accounts/[id]';
import CategoryEditScreen from '@/app/categories/[id]';

describe('カテゴリ・口座の編集画面', () => {
  it.each([
    ['使われているカテゴリ', { transactions: 3, rules: 1, children: 0, employers: 0, cards: 0 }],
    ['使われていないカテゴリ', { transactions: 0, rules: 0, children: 0, employers: 0, cards: 0 }],
  ])('%s', async (_, usage) => {
    mockParams.current = { id: 'eat' };
    mockUsage.current = usage;
    expect(await renderAndCheck(<CategoryEditScreen />)).toEqual([]);
  });

  it.each([
    ['使われている口座', { transactions: 3, rules: 0, children: 0, employers: 0, cards: 0 }],
    ['使われていない口座', { transactions: 0, rules: 0, children: 0, employers: 0, cards: 0 }],
  ])('%s', async (_, usage) => {
    mockParams.current = { id: 'bank' };
    mockUsage.current = usage;
    expect(await renderAndCheck(<AccountEditScreen />)).toEqual([]);
  });
});
