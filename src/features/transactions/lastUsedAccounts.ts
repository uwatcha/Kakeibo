import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TransactionType } from './transactionRules';

// 入力画面の口座の初期値（REQ-30）。端末ごとの便利機能なので AsyncStorage に置く
const STORAGE_KEY = 'kakeibo:lastUsedAccounts';

type LastUsed = Partial<Record<TransactionType, { fromAccountId: string | null; toAccountId: string | null }>>;

export async function loadLastUsedAccounts(): Promise<LastUsed> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LastUsed) : {};
  } catch {
    return {};
  }
}

export async function saveLastUsedAccounts(
  type: TransactionType,
  accounts: { fromAccountId: string | null; toAccountId: string | null },
): Promise<void> {
  try {
    const current = await loadLastUsedAccounts();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [type]: accounts }));
  } catch {
    // 保存できなくても入力自体には影響しない
  }
}
