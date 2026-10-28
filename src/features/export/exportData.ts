import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { toTokyoDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';

import { transactionsToCsv } from './csv';

/** すべての行を取る（1回 1000 行までなので分けて取る） */
async function fetchAll<T>(
  table: 'accounts' | 'categories' | 'transactions' | 'employers' | 'recurring_rules' | 'credit_card_settings',
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

async function shareText(fileName: string, content: string, mimeType: string): Promise<void> {
  // Web 版（PC）は共有の代わりに、ファイルとしてダウンロードする
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

/** 記録を CSV にして共有する（REQ-38） */
export async function exportTransactionsCsv(): Promise<void> {
  const [transactions, accounts, categories] = await Promise.all([
    fetchAll<{ id: string } & Parameters<typeof transactionsToCsv>[0][number]>('transactions'),
    fetchAll<{ id: string; name: string }>('accounts'),
    fetchAll<{ id: string; name: string; parent_id: string | null }>('categories'),
  ]);
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '';
  const categoryName = (id: string | null) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return '';
    const parent = categories.find((x) => x.id === c.parent_id);
    return parent ? `${parent.name} / ${c.name}` : c.name;
  };
  await shareText(
    `kakeibo-${toTokyoDateString()}.csv`,
    transactionsToCsv(transactions, accountName, categoryName),
    'text/csv',
  );
}

/** すべてのデータを JSON にして共有する（REQ-37 バックアップ） */
export async function exportBackupJson(): Promise<void> {
  const [accounts, categories, transactions, employers, recurringRules, cardSettings] = await Promise.all([
    fetchAll('accounts'),
    fetchAll('categories'),
    fetchAll('transactions'),
    fetchAll('employers'),
    fetchAll('recurring_rules'),
    fetchAll('credit_card_settings'),
  ]);
  const backup = {
    format: 'kakeibo-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
    categories,
    transactions,
    employers,
    recurring_rules: recurringRules,
    credit_card_settings: cardSettings,
  };
  await shareText(`kakeibo-backup-${toTokyoDateString()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}
