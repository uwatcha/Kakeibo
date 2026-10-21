import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/features/accounts/hooks';

import {
  confirmTransactions,
  createTransaction,
  deleteTransaction,
  fetchAccountTransactions,
  fetchAdvancesFor,
  fetchExpensesAround,
  fetchUnconfirmed,
  fetchPayeeHistory,
  fetchMonthTransactions,
  fetchTransaction,
  searchTransactions,
  type TransactionInsert,
  type TransactionUpdate,
  updateTransaction,
} from './api';

export const transactionKeys = {
  all: ['transactions'] as const,
  month: (month: string) => [...transactionKeys.all, 'month', month] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
  search: (filter: string) => [...transactionKeys.all, 'search', filter] as const,
  account: (accountId: string) => [...transactionKeys.all, 'account', accountId] as const,
  payees: () => [...transactionKeys.all, 'payees'] as const,
  expensesAround: (date: string) => [...transactionKeys.all, 'expensesAround', date] as const,
  advancesFor: (id: string) => [...transactionKeys.all, 'advancesFor', id] as const,
  unconfirmed: (today: string) => [...transactionKeys.all, 'unconfirmed', today] as const,
};

export function useMonthTransactions(month: string) {
  return useQuery({ queryKey: transactionKeys.month(month), queryFn: () => fetchMonthTransactions(month) });
}

/** filter が null のあいだは検索しない */
export function useSearchTransactions(filter: string | null) {
  return useQuery({
    queryKey: transactionKeys.search(filter ?? ''),
    queryFn: () => searchTransactions(filter!),
    enabled: filter !== null,
  });
}

export function useAccountTransactions(accountId: string) {
  return useQuery({
    queryKey: transactionKeys.account(accountId),
    queryFn: () => fetchAccountTransactions(accountId),
  });
}

export function usePayeeHistory() {
  return useQuery({ queryKey: transactionKeys.payees(), queryFn: fetchPayeeHistory });
}

/** 立て替えの「元の支払い」の候補（その日の前後1週間の支払い） */
export function useExpensesAround(date: string, enabled: boolean) {
  return useQuery({
    queryKey: transactionKeys.expensesAround(date),
    queryFn: () => fetchExpensesAround(date, 7),
    enabled,
  });
}

export function useAdvancesFor(expenseId: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.advancesFor(expenseId ?? ''),
    queryFn: () => fetchAdvancesFor(expenseId!),
    enabled: !!expenseId,
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? ''),
    queryFn: () => fetchTransaction(id!),
    enabled: !!id,
  });
}

/** 記録が変わると残高と集計も変わるので、まとめて再取得する */
function useInvalidateAfterWrite() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]);
}

export function useCreateTransaction() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({ mutationFn: (values: TransactionInsert) => createTransaction(values), onSuccess: invalidate });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TransactionUpdate }) => updateTransaction(id, values),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({ mutationFn: (id: string) => deleteTransaction(id), onSuccess: invalidate });
}

/** 日付が過ぎたのに未確認の記録 */
export function useUnconfirmed(today: string) {
  return useQuery({ queryKey: transactionKeys.unconfirmed(today), queryFn: () => fetchUnconfirmed(today) });
}

/** 確認済みにすると残高・集計に入るので、記録・残高・集計をまとめて読み直す */
export function useConfirmTransactions() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({ mutationFn: (ids: string[]) => confirmTransactions(ids), onSuccess: invalidate });
}
