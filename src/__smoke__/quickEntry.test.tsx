// ウィジェットから出す入力シートを描いてみる（React Compiler を通す。jest.config.js）
/* eslint-disable @typescript-eslint/no-require-imports, import/first -- jest.mock は import より先に置く */
import { renderAndCheck } from './helpers';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => undefined,
}));
const mockQ = (data: unknown) => ({ data, error: null, refetch: jest.fn(), isLoading: false });
const mockM = () => ({ mutateAsync: jest.fn(), mutate: jest.fn(), isPending: false, isError: false, reset: jest.fn() });
const mockAccounts = mockQ([
  { id: 'wallet', name: '財布', kind: 'cash', is_archived: false, is_reserved: false, default_category_id: null },
]);
const mockCategories = mockQ([{ id: 'food', name: '食費', kind: 'expense', parent_id: null, is_archived: false }]);
const mockEmpty = mockQ([]);
jest.mock('@/features/accounts/hooks', () => ({
  useAccounts: () => mockAccounts,
  useBalanceMap: () => undefined,
  useCreateAccount: () => mockM(),
}));
jest.mock('@/features/categories/hooks', () => ({ useCategories: () => mockCategories }));
jest.mock('@/features/employers/hooks', () => ({ useEmployers: () => mockEmpty }));
jest.mock('@/features/transactions/hooks', () => ({
  useCreateTransaction: () => mockM(),
  usePayeeHistory: () => mockEmpty,
}));

import { QuickEntrySheet } from '@/features/quick/QuickEntrySheet';

it('ウィジェットの入力シート', async () => {
  expect(await renderAndCheck(<QuickEntrySheet />)).toEqual([]);
});
