import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/features/accounts/hooks';

import {
  createTransaction,
  deleteTransaction,
  fetchAccountTransactions,
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
