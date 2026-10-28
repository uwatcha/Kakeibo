import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { addDays, addMonths, formatDay, monthStart, toTokyoDateString } from '@/lib/date';
import { formatYen, parseNonNegativeYen } from '@/lib/money';

import { EMPTY_FILTERS, type SearchFilters } from '../search';
import { TRANSACTION_RULES, type TransactionType } from '../transactionRules';
import { DateField } from './DateField';

type Field = 'types' | 'accounts' | 'categories' | 'period' | 'amount' | 'sources';

const SOURCES: { value: SearchFilters['sources'][number]; label: string }[] = [
  { value: 'manual', label: '手入力' },
  { value: 'email', label: 'メール' },
  { value: 'photo', label: '写真' },
];

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** 値を選ぶチップを並べる（いくつでも選べる） */
function Choices<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string; icon?: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((o) => (
        <Chip
          key={o.value}
          icon={selected.includes(o.value) ? 'check' : o.icon}
          selected={selected.includes(o.value)}
          showSelectedOverlay
          onPress={() => onToggle(o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </View>
  );
}

/**
 * 記録の検索の、項目ごとの絞り込み（2026-10-28 改善要望: Notion のフィルターのように）。
 * 検索窓の下に項目のボタンを並べ、押すと値を選ぶ。選んでいる項目はボタンに値を出し、✕ で外す
 */
export function SearchFiltersBar({
  filters,
  onChange,
  accounts,
  categories,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  accounts: readonly Account[];
  categories: readonly Category[];
}) {
  const [open, setOpen] = useState<Field | null>(null);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const today = toTokyoDateString();

  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  const names = (ids: readonly string[], nameOf: (id: string) => string | null | undefined) =>
    ids.length === 0 ? null : ids.length === 1 ? (nameOf(ids[0]) ?? '1件') : `${ids.length}件`;

  const usableAccounts = accounts.filter((a) => !a.is_archived);
  const usableCategories = categories.filter((c) => !c.is_archived);

  const items: { field: Field; label: string; value: string | null; clear: Partial<SearchFilters> }[] = [
    {
      field: 'types',
      label: '種類',
      value: names(filters.types, (t) => TRANSACTION_RULES[t as TransactionType]?.label),
      clear: { types: [] },
    },
    {
      field: 'accounts',
      label: '口座',
      value: names(filters.accountIds, (id) => accounts.find((a) => a.id === id)?.name),
      clear: { accountIds: [] },
    },
    {
      field: 'categories',
      label: 'カテゴリ',
      value: names(filters.categoryIds, (id) => categoryLabel(id, categories)),
      clear: { categoryIds: [] },
    },
    {
      field: 'period',
      label: '期間',
      value:
        filters.from || filters.to
          ? `${filters.from ? formatDay(filters.from) : ''}〜${filters.to ? formatDay(filters.to) : ''}`
          : null,
      clear: { from: null, to: null },
    },
    {
      field: 'amount',
      label: '金額',
      value:
        filters.amountMin !== null || filters.amountMax !== null
          ? `${filters.amountMin !== null ? formatYen(filters.amountMin) : ''}〜${filters.amountMax !== null ? formatYen(filters.amountMax) : ''}`
          : null,
      clear: { amountMin: null, amountMax: null },
    },
    {
      field: 'sources',
      label: '入力元',
      value: names(filters.sources, (s) => SOURCES.find((x) => x.value === s)?.label),
      clear: { sources: [] },
    },
  ];

  const presets: { label: string; from: string; to: string }[] = [
    { label: '今月', from: monthStart(today), to: addDays(addMonths(monthStart(today), 1), -1) },
    { label: '先月', from: addMonths(monthStart(today), -1), to: addDays(monthStart(today), -1) },
    { label: '3か月', from: addDays(today, -90), to: today },
    { label: '今年', from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` },
  ];

  const openField = (field: Field) => {
    if (field === 'amount') {
      setAmountMin(filters.amountMin === null ? '' : String(filters.amountMin));
      setAmountMax(filters.amountMax === null ? '' : String(filters.amountMax));
    }
    setOpen(field);
  };
  const closeDialog = () => {
    if (open === 'amount') {
      set({ amountMin: parseNonNegativeYen(amountMin), amountMax: parseNonNegativeYen(amountMax) });
    }
    setOpen(null);
  };

  const title = items.find((i) => i.field === open)?.label ?? '';

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.bar}
      >
        {items.map((item) => (
          <Chip
            key={item.field}
            mode={item.value ? 'flat' : 'outlined'}
            selected={!!item.value}
            icon={item.value ? 'filter' : 'chevron-down'}
            onPress={() => openField(item.field)}
            onClose={item.value ? () => set(item.clear) : undefined}
          >
            {item.value ? `${item.label}: ${item.value}` : item.label}
          </Chip>
        ))}
        {Object.values(items).some((i) => i.value) && (
          <Chip mode="outlined" icon="close" onPress={() => onChange(EMPTY_FILTERS)}>
            すべて外す
          </Chip>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={open !== null} onDismiss={closeDialog} style={styles.dialog}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.ScrollArea style={styles.area}>
            <ScrollView contentContainerStyle={styles.areaContent} keyboardShouldPersistTaps="handled">
              {open === 'types' && (
                <Choices
                  options={(Object.keys(TRANSACTION_RULES) as TransactionType[]).map((t) => ({
                    value: t,
                    label: TRANSACTION_RULES[t].label,
                    icon: TRANSACTION_RULES[t].icon,
                  }))}
                  selected={filters.types}
                  onToggle={(t) => set({ types: toggle(filters.types, t) })}
                />
              )}
              {open === 'accounts' && (
                <Choices
                  options={usableAccounts.map((a) => ({ value: a.id, label: a.name }))}
                  selected={filters.accountIds}
                  onToggle={(id) => set({ accountIds: toggle(filters.accountIds, id) })}
                />
              )}
              {open === 'categories' && (
                <Choices
                  // 支出 → 収入の順に、大分類のあとに小分類。収入は「収入:」を付けて、同じ名前（その他）と見分ける
                  options={usableCategories
                    .map((c) => ({
                      value: c.id,
                      kind: c.kind,
                      label: `${c.kind === 'income' ? '収入: ' : ''}${categoryLabel(c.id, categories) ?? c.name}`,
                    }))
                    .sort((a, b) => Number(a.kind === 'income') - Number(b.kind === 'income') || a.label.localeCompare(b.label, 'ja'))}
                  selected={filters.categoryIds}
                  onToggle={(id) => set({ categoryIds: toggle(filters.categoryIds, id) })}
                />
              )}
              {open === 'period' && (
                <View style={styles.period}>
                  <View style={styles.choices}>
                    {presets.map((p) => (
                      <Chip
                        key={p.label}
                        selected={filters.from === p.from && filters.to === p.to}
                        showSelectedOverlay
                        onPress={() => set({ from: p.from, to: p.to })}
                      >
                        {p.label}
                      </Chip>
                    ))}
                  </View>
                  <Text variant="labelLarge">から</Text>
                  <DateField value={filters.from ?? today} onChange={(d) => set({ from: d })} />
                  <Text variant="labelLarge">まで</Text>
                  <DateField value={filters.to ?? today} onChange={(d) => set({ to: d })} />
                </View>
              )}
              {open === 'amount' && (
                <View style={styles.period}>
                  <TextInput
                    mode="outlined"
                    label="下限"
                    keyboardType="number-pad"
                    value={amountMin}
                    onChangeText={setAmountMin}
                    right={<TextInput.Affix text="円" />}
                  />
                  <TextInput
                    mode="outlined"
                    label="上限"
                    keyboardType="number-pad"
                    value={amountMax}
                    onChangeText={setAmountMax}
                    right={<TextInput.Affix text="円" />}
                  />
                </View>
              )}
              {open === 'sources' && (
                <Choices
                  options={SOURCES}
                  selected={filters.sources}
                  onToggle={(s) => set({ sources: toggle(filters.sources, s) })}
                />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={closeDialog}>閉じる</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  dialog: { maxHeight: '80%' },
  area: { paddingHorizontal: 0 },
  areaContent: { padding: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  period: { gap: 8 },
});
