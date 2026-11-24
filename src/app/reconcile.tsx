import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ChipGroup } from '@/components/ChipGroup';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { compareAccounts, PERSON_KINDS } from '@/features/accounts/accountKinds';
import { useAccounts } from '@/features/accounts/hooks';
import { AiError, extractRecords } from '@/features/ai/api';
import { useAttachments } from '@/features/ai/useAttachments';
import { fetchAccountRecordsBetween } from '@/features/reconcile/api';
import {
  DATE_TOLERANCE_DAYS,
  reconcile,
  type StatementRow,
  statementPrompt,
  toStatementRows,
} from '@/features/reconcile/match';
import { transactionKeys } from '@/features/transactions/hooks';
import { TRANSACTION_RULES, type TransactionType } from '@/features/transactions/transactionRules';
import { addDays, formatDay, toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

/**
 * 明細の照らし合わせ（2026-11-24 改善要望）。口座の明細（通帳・ネットバンキング・決済アプリの取引履歴の画面や CSV）を
 * AI に読み取らせ、記録との照らし合わせはアプリが決まったとおりに行う（features/reconcile/match.ts）。
 * 「記録にない」行を押すと、その日付・金額・内容を入れた記録の画面を開く。「明細にない」記録を押すと、その記録を開く
 */
export default function ReconcileScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(params.accountId ?? null);
  const files = useAttachments();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = (accounts.data ?? [])
    .filter((a) => !a.is_archived && !PERSON_KINDS.includes(a.kind))
    .sort(compareAccounts);
  const account = choices.find((a) => a.id === accountId) ?? null;

  const dates = (rows ?? []).map((r) => r.date).sort();
  const range =
    dates.length > 0
      ? { from: addDays(dates[0], -DATE_TOLERANCE_DAYS), to: addDays(dates[dates.length - 1], DATE_TOLERANCE_DAYS) }
      : null;
  // 記録を足す・消すと読み直す（transactionKeys.all の下に置く）
  const records = useQuery({
    queryKey: [...transactionKeys.all, 'reconcile', accountId, range?.from, range?.to],
    queryFn: () => {
      // React Compiler では x!.y が描画のたびに読まれることがあるので、確かめてから読む
      if (!accountId || !range) return [];
      return fetchAccountRecordsBetween(accountId, range.from, range.to);
    },
    enabled: !!accountId && !!range,
  });

  const read = async () => {
    if (!account) return;
    setReading(true);
    setError(null);
    try {
      const { records: found } = await extractRecords(
        statementPrompt(toTokyoDateString(), account.name),
        [...files.attachments.flatMap((a) => (a.kind === 'text' ? [`# ${a.name}\n${a.text}`] : [])), text.trim()]
          .filter(Boolean)
          .join('\n\n'),
        files.attachments.flatMap((a) => (a.kind === 'file' ? [{ mimeType: a.mimeType, data: a.data }] : [])),
      );
      const next = toStatementRows(found);
      if (next.length === 0) setError('明細の取引を読み取れませんでした');
      else setRows(next);
    } catch (e) {
      setError(e instanceof AiError ? e.message : '読み取れませんでした。通信状態を確かめてください');
    } finally {
      setReading(false);
    }
  };

  const restart = () => {
    setRows(null);
    files.clear();
    setText('');
  };

  const result = rows && records.data ? reconcile(rows, records.data) : null;
  const typeLabel = (type: string) => TRANSACTION_RULES[type as TransactionType]?.label ?? type;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionCard title="口座">
          <View style={styles.pad}>
            <ChipGroup
              options={choices.map((a) => ({ value: a.id, label: a.name }))}
              value={accountId}
              onChange={(v) => {
                setAccountId(v);
                setRows(null);
              }}
            />
          </View>
        </SectionCard>

        {rows === null ? (
          <>
            <View style={styles.buttons}>
              {Platform.OS !== 'web' && (
                <Button mode="outlined" icon="camera" onPress={() => files.addImage(true)} disabled={reading}>
                  写真を撮る
                </Button>
              )}
              <Button mode="outlined" icon="image" onPress={() => files.addImage(false)} disabled={reading}>
                画像を選ぶ
              </Button>
              <Button mode="outlined" icon="file-document-outline" onPress={files.addFile} disabled={reading}>
                ファイルを選ぶ
              </Button>
            </View>
            {files.attachments.length > 0 && (
              <View style={styles.chips}>
                {files.attachments.map((a) => (
                  <Chip
                    key={a.key}
                    icon={a.kind === 'text' ? 'file-document-outline' : 'image'}
                    onClose={() => files.remove(a.key)}
                  >
                    {a.name}
                  </Chip>
                ))}
              </View>
            )}
            <TextInput mode="outlined" label="テキスト（任意）" value={text} onChangeText={setText} multiline />
            <Button
              mode="contained"
              icon="file-compare"
              onPress={read}
              loading={reading}
              disabled={reading || !account || (files.attachments.length === 0 && text.trim() === '')}
            >
              照らし合わせる
            </Button>
            {(error || files.error) && <HelperText type="error">{error ?? files.error}</HelperText>}
          </>
        ) : !result ? (
          <Text style={styles.pad}>{records.isError ? '記録を読み込めませんでした' : '読み込み中…'}</Text>
        ) : (
          <>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {`${formatDay(dates[0])}〜${formatDay(dates[dates.length - 1])}・明細 ${rows.length}件`}
            </Text>
            <SectionCard title={`記録にない（${result.missing.length}件）`}>
              {result.missing.length === 0 ? (
                <Text style={styles.pad}>ありません</Text>
              ) : (
                result.missing.map((r) => (
                  <ListRow
                    key={r.key}
                    title={r.description ?? (r.direction === 'out' ? '出金' : '入金')}
                    subtitle={formatDay(r.date)}
                    icon="plus-circle-outline"
                    iconColor={theme.colors.error}
                    onPress={() => {
                      if (!account) return;
                      router.push({
                        pathname: '/transaction/[id]',
                        params: {
                          id: 'new',
                          accountId: account.id,
                          direction: r.direction,
                          date: r.date,
                          amount: String(r.amount),
                          payee: r.description ?? '',
                        },
                      });
                    }}
                    right={
                      <Amount
                        value={r.amount}
                        kind={r.direction === 'out' ? 'expense' : 'income'}
                        variant="bodyLarge"
                      />
                    }
                  />
                ))
              )}
            </SectionCard>
            <SectionCard title={`明細にない記録（${result.extra.length}件）`}>
              {result.extra.length === 0 ? (
                <Text style={styles.pad}>ありません</Text>
              ) : (
                result.extra.map((t) => (
                  <ListRow
                    key={t.id}
                    title={t.payee ?? typeLabel(t.type)}
                    subtitle={[formatDay(t.date), typeLabel(t.type), t.isConfirmed ? null : '未確認']
                      .filter(Boolean)
                      .join('・')}
                    icon="help-circle-outline"
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                    right={
                      <Amount
                        value={t.amount}
                        kind={t.direction === 'out' ? 'expense' : 'income'}
                        variant="bodyLarge"
                      />
                    }
                  />
                ))
              )}
            </SectionCard>
            <SectionCard title={`一致（${result.matched.length}件）`}>
              {result.matched.map(({ row, record }) => (
                <ListRow
                  key={row.key}
                  title={record.payee ?? row.description ?? typeLabel(record.type)}
                  subtitle={[
                    formatDay(row.date),
                    record.date !== row.date ? `記録は${formatDay(record.date)}` : null,
                    row.description,
                  ]
                    .filter(Boolean)
                    .join('・')}
                  icon="check-circle-outline"
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: record.id } })}
                  right={
                    <Amount
                      value={row.amount}
                      kind={row.direction === 'out' ? 'expense' : 'income'}
                      variant="bodyLarge"
                    />
                  }
                />
              ))}
            </SectionCard>
            <Button onPress={restart}>別の明細を照らし合わせる</Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, gap: SPACING.gap },
  pad: { padding: SPACING.row },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
