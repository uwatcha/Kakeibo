import type { Database } from '@/types/database';

import { TRANSACTION_RULES } from '../transactions/transactionRules';

type Transaction = Database['public']['Tables']['transactions']['Row'];

/** CSV の1項目。カンマ・改行・引用符を含むときは引用符で囲む */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 記録を CSV にする（古い順）。Excel でも文字化けしないよう先頭に BOM を付ける */
export function transactionsToCsv(
  transactions: readonly Transaction[],
  accountName: (id: string | null) => string,
  categoryName: (id: string | null) => string,
): string {
  const header = ['日付', '種類', '金額', '出金元', '入金先', 'カテゴリ', '内容', 'メモ', '定期'];
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map((t) => [
      t.date,
      TRANSACTION_RULES[t.type].label,
      t.amount,
      accountName(t.from_account_id),
      accountName(t.to_account_id),
      categoryName(t.category_id),
      t.payee,
      t.memo,
      t.recurring_rule_id ? '定期' : '',
    ]);
  return '﻿' + [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
