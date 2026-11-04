import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accountKeys } from '@/features/accounts/hooks';

import {
  confirmTransactions,
  createTransaction,
  createTransactions,
  deleteTransaction,
  fetchAccountTransactions,
  fetchAdvancesFor,
  fetchAdvancesTo,
  fetchCollectsFrom,
  saveTransactionItems,
  setAdvancesRepaidBy,
  fetchUnconfirmed,
  fetchPayeeHistory,
  fetchMonthTransactions,
  fetchTransactionsBetween,
  fetchTransaction,
  searchTransactions,
  type TransactionInsert,
  type TransactionUpdate,
  updateTransaction,
} from './api';
import type { TransactionItem } from './items';
import { hasFilters, type SearchFilters } from './search';

export const transactionKeys = {
  all: ['transactions'] as const,
  month: (month: string) => [...transactionKeys.all, 'month', month] as const,
  between: (from: string, to: string) => [...transactionKeys.all, 'between', from, to] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
  search: (filter: string) => [...transactionKeys.all, 'search', filter] as const,
  account: (accountId: string) => [...transactionKeys.all, 'account', accountId] as const,
  payees: () => [...transactionKeys.all, 'payees'] as const,
  collectsFrom: (personId: string, since: string) => [...transactionKeys.all, 'collectsFrom', personId, since] as const,
  advancesTo: (personId: string) => [...transactionKeys.all, 'advancesTo', personId] as const,
  advancesFor: (id: string) => [...transactionKeys.all, 'advancesFor', id] as const,
  unconfirmed: (today: string) => [...transactionKeys.all, 'unconfirmed', today] as const,
};

export function useMonthTransactions(month: string) {
  return useQuery({ queryKey: transactionKeys.month(month), queryFn: () => fetchMonthTransactions(month) });
}

/** from〜to の記録（内訳つき）。from が決まるまでは読まない */
export function useTransactionsBetween(from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.between(from ?? '', to ?? ''),
    queryFn: () => fetchTransactionsBetween(from!, to!),
    enabled: !!from && !!to,
  });
}

/** filter が null のあいだは検索しない */
/** 記録を探す（text は言葉の検索、filters は項目ごとの絞り込み）。どちらもなければ探さない */
export function useSearchTransactions(text: string | null, filters: SearchFilters, enabled: boolean) {
  return useQuery({
    queryKey: transactionKeys.search(JSON.stringify({ text, filters })),
    queryFn: () => searchTransactions(text, filters),
    enabled: enabled && (text !== null || hasFilters(filters)),
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
/** 立て替えの「返してもらった記録」の候補: その相手からの、立て替えた日以降の貸し金戻り */
export function useCollectsFrom(personId: string | null, since: string, enabled: boolean) {
  return useQuery({
    queryKey: transactionKeys.collectsFrom(personId ?? '', since),
    queryFn: () => fetchCollectsFrom(personId!, since),
    enabled: enabled && !!personId,
  });
}

/** 貸し金戻りの「返してもらった立て替え」の候補: その相手への立て替え */
export function useAdvancesTo(personId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: transactionKeys.advancesTo(personId ?? ''),
    queryFn: () => fetchAdvancesTo(personId!),
    enabled: enabled && !!personId,
  });
}

/** その貸し金戻りで返してもらった立て替え */
export function useAdvancesFor(collectId: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.advancesFor(collectId ?? ''),
    queryFn: () => fetchAdvancesFor(collectId!),
    enabled: !!collectId,
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

export function useCreateTransactions() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({ mutationFn: (rows: TransactionInsert[]) => createTransactions(rows), onSuccess: invalidate });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TransactionUpdate }) => updateTransaction(id, values),
    onSuccess: invalidate,
  });
}

/** 記録の内訳を入れ直す（保存のあと。終わったら一覧を読み直す） */
export function useSaveTransactionItems() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: ({ transactionId, items }: { transactionId: string; items: TransactionItem[] }) =>
      saveTransactionItems(transactionId, items),
    onSuccess: invalidate,
  });
}

/** 貸し金戻りで返してもらった立て替えを入れ直す */
export function useSetAdvancesRepaidBy() {
  const invalidate = useInvalidateAfterWrite();
  return useMutation({
    mutationFn: ({ collectId, advanceIds }: { collectId: string; advanceIds: string[] }) =>
      setAdvancesRepaidBy(collectId, advanceIds),
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
