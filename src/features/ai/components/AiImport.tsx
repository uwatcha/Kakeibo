import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Chip, HelperText, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { ASSET_KINDS } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/tree';
import { fetchDateAmountsBetween } from '@/features/transactions/api';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { isConfirmedOnSave } from '@/features/transactions/confirmation';
import { useCreateTransactions } from '@/features/transactions/hooks';
import { amountKindOf, TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';
import { SPACING } from '@/theme';

import type { Aliases } from '../anonymize';
import { AiError, extractRecords } from '../api';
import { extractPrompt, type ImportDraft, markDuplicates, toDrafts } from '../extract';

/** 写真・PDF などは base64 で送る。大きすぎると送れないので、この大きさまで */
const MAX_BASE64 = 8_000_000;
/** 1回に読み取るファイルの数 */
const MAX_FILES = 5;

type Attachment = { key: string; name: string } & (
  { kind: 'file'; mimeType: string; data: string } | { kind: 'text'; text: string }
);

const isTextFile = (name: string, mimeType?: string) =>
  /^text\//.test(mimeType ?? '') || /json|csv/.test(mimeType ?? '') || /\.(csv|json|txt|tsv)$/i.test(name);

type Props = {
  today: string;
  accounts: readonly Account[];
  categories: readonly Category[];
  aliases: Aliases;
  balances: ReadonlyMap<string, number> | undefined;
};

/**
 * AI入力: レシート・明細の写真や CSV・JSON などのファイルから、AI が記録を読み取る。
 * 読み取った記録は一覧で確かめてから保存する（同じ日・同じ金額の記録があれば重複として最初は外す）
 */
export function AiImport({ today, accounts, categories, aliases, balances }: Props) {
  const theme = useTheme();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // AI が口座を選べなかった行に使う口座
  const [payFrom, setPayFrom] = useState<string | null>(null);
  const [payTo, setPayTo] = useState<string | null>(null);
  const create = useCreateTransactions();
  const [saved, setSaved] = useState<number | null>(null);

  const add = (next: Attachment) => {
    setError(null);
    setAttachments((list) => [...list, next].slice(0, MAX_FILES));
  };

  const addImage = async (camera: boolean) => {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('カメラを使う許可がありません');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      if (asset.base64.length > MAX_BASE64) {
        setError('画像が大きすぎます');
        return;
      }
      add({
        key: asset.uri,
        name: asset.fileName ?? '写真',
        kind: 'file',
        mimeType: asset.mimeType ?? 'image/jpeg',
        data: asset.base64,
      });
    } catch {
      setError('画像を読み込めませんでした');
    }
  };

  const addFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', 'application/pdf', 'image/*', 'text/csv', 'text/comma-separated-values'],
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const file = new File(asset.uri);
      if (isTextFile(asset.name, asset.mimeType)) {
        add({ key: asset.uri, name: asset.name, kind: 'text', text: (await file.text()).slice(0, 150_000) });
      } else {
        const data = await file.base64();
        if (data.length > MAX_BASE64) {
          setError('ファイルが大きすぎます');
          return;
        }
        add({ key: asset.uri, name: asset.name, kind: 'file', mimeType: asset.mimeType ?? 'application/pdf', data });
      }
    } catch {
      setError('ファイルを読み込めませんでした');
    }
  };

  const read = async () => {
    setReading(true);
    setError(null);
    try {
      const files = attachments.flatMap((a) => (a.kind === 'file' ? [{ mimeType: a.mimeType, data: a.data }] : []));
      const texts = [
        ...attachments.flatMap((a) => (a.kind === 'text' ? [`# ${a.name}\n${a.text}`] : [])),
        text.trim(),
      ].filter(Boolean);
      const { records } = await extractRecords(
        extractPrompt(today, accounts.map(toAccountLike), categories, aliases),
        texts.join('\n\n'),
        files,
      );
      const found = toDrafts(records, accounts, categories, aliases);
      if (found.length === 0) {
        setError('記録を読み取れませんでした');
        return;
      }
      const dates = found.map((d) => d.date).sort();
      const existing = await fetchDateAmountsBetween(dates[0], dates[dates.length - 1]);
      const marked = markDuplicates(found, existing);
      setDrafts(marked);
      setSelected(new Set(marked.filter((d) => !d.duplicate).map((d) => d.key)));
    } catch (e) {
      setError(e instanceof AiError ? e.message : '読み取れませんでした');
    } finally {
      setReading(false);
    }
  };

  // 保存できる行（口座が決まっている）
  const resolved = (d: ImportDraft) => ({
    ...d,
    fromAccountId: d.type === 'income' ? null : (d.fromAccountId ?? (d.type === 'expense' ? payFrom : null)),
    toAccountId: d.type === 'expense' ? null : (d.toAccountId ?? (d.type === 'income' ? payTo : null)),
  });
  const ready = (d: ImportDraft) => {
    const r = resolved(d);
    return (d.type === 'income' || !!r.fromAccountId) && (d.type === 'expense' || !!r.toAccountId);
  };
  const toSave = (drafts ?? []).filter((d) => selected.has(d.key) && ready(d));
  const needsFrom = (drafts ?? []).some((d) => d.type === 'expense' && !d.fromAccountId);
  const needsTo = (drafts ?? []).some((d) => d.type === 'income' && !d.toAccountId);

  const save = async () => {
    try {
      await create.mutateAsync(
        toSave.map((d) => {
          const r = resolved(d);
          return {
            type: d.type,
            amount: d.amount,
            date: d.date,
            payee: d.payee,
            category_id: d.categoryId,
            from_account_id: r.fromAccountId,
            to_account_id: r.toAccountId,
            is_confirmed: isConfirmedOnSave(d.date, today),
          };
        }),
      );
      setSaved(toSave.length);
      setDrafts(null);
      setAttachments([]);
      setText('');
    } catch {
      // Snackbar で知らせる
    }
  };

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {drafts === null ? (
          <>
            <View style={styles.buttons}>
              <Button mode="outlined" icon="camera" onPress={() => addImage(true)} disabled={reading}>
                写真を撮る
              </Button>
              <Button mode="outlined" icon="image" onPress={() => addImage(false)} disabled={reading}>
                画像を選ぶ
              </Button>
              <Button mode="outlined" icon="file-document-outline" onPress={addFile} disabled={reading}>
                ファイルを選ぶ
              </Button>
            </View>
            {attachments.length > 0 && (
              <View style={styles.chips}>
                {attachments.map((a) => (
                  <Chip
                    key={a.key}
                    icon={a.kind === 'text' ? 'file-document-outline' : 'image'}
                    onClose={() => setAttachments((list) => list.filter((x) => x.key !== a.key))}
                  >
                    {a.name}
                  </Chip>
                ))}
              </View>
            )}
            <TextInput
              mode="outlined"
              label="テキスト（任意）"
              value={text}
              onChangeText={setText}
              multiline
              style={styles.text}
            />
            <Button
              mode="contained"
              icon="text-recognition"
              onPress={read}
              loading={reading}
              disabled={reading || (attachments.length === 0 && text.trim() === '')}
            >
              読み取る
            </Button>
            {error && <HelperText type="error">{error}</HelperText>}
          </>
        ) : (
          <>
            {needsFrom && (
              <AccountPicker
                label="支払いの口座"
                kinds={TRANSACTION_RULES.expense.from!.kinds}
                accounts={accounts}
                value={payFrom}
                onChange={setPayFrom}
                balances={balances}
                rows={2}
              />
            )}
            {needsTo && (
              <AccountPicker
                label="入金の口座"
                kinds={ASSET_KINDS}
                accounts={accounts}
                value={payTo}
                onChange={setPayTo}
                balances={balances}
                rows={2}
              />
            )}
            <SectionCard title={`読み取った記録（${drafts.length}件）`}>
              {drafts.map((d) => {
                const r = resolved(d);
                const where = [accountName(r.fromAccountId), accountName(r.toAccountId)].filter(Boolean).join(' → ');
                return (
                  <ListRow
                    key={d.key}
                    title={d.payee ?? TRANSACTION_RULES[d.type].label}
                    subtitle={
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {[formatDay(d.date), categoryLabel(d.categoryId, categories), where || '口座なし']
                          .filter(Boolean)
                          .join('・')}
                        {d.duplicate && <Text style={{ color: theme.colors.error }}>・重複の可能性</Text>}
                      </Text>
                    }
                    icon={TRANSACTION_RULES[d.type].icon}
                    onPress={() => toggle(d.key)}
                    disabled={!ready(d)}
                    right={
                      <View style={styles.right}>
                        <Amount value={d.amount} kind={amountKindOf(d.type)} variant="bodyLarge" />
                        <Checkbox status={selected.has(d.key) && ready(d) ? 'checked' : 'unchecked'} />
                      </View>
                    }
                  />
                );
              })}
            </SectionCard>
            <Button
              mode="contained"
              icon="content-save"
              onPress={save}
              loading={create.isPending}
              disabled={create.isPending || toSave.length === 0}
            >
              {toSave.length}件を記録する
            </Button>
            <Button onPress={() => setDrafts(null)} disabled={create.isPending}>
              やり直す
            </Button>
          </>
        )}
      </ScrollView>
      <Snackbar visible={saved !== null} onDismiss={() => setSaved(null)}>
        {saved}件を記録しました
      </Snackbar>
      <Snackbar visible={create.isError} onDismiss={create.reset}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

const toAccountLike = (a: Account) => ({ id: a.id, kind: a.kind, isArchived: a.is_archived });

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, gap: SPACING.gap, paddingBottom: 48 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  text: { maxHeight: 160 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
