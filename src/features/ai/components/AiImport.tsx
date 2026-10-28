import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Snackbar, TextInput } from 'react-native-paper';

import type { Account } from '@/features/accounts/api';
import type { Category } from '@/features/categories/api';
import { fetchDateAmountsBetween } from '@/features/transactions/api';
import { useCreateTransactions } from '@/features/transactions/hooks';
import { addDays } from '@/lib/date';
import { SPACING } from '@/theme';

import type { Aliases } from '../anonymize';
import { AiError, extractRecords } from '../api';
import {
  assignPaymentAccounts,
  draftToRow,
  extractPrompt,
  type FallbackAccounts,
  type ImportDraft,
  isDraftReady,
  markDuplicates,
  toDrafts,
} from '../extract';
import { clearImportJob, type ImportJob, loadImportJob, saveImportJob } from '../importJob';
import { defaultCashAccount, matchPaymentAccount, matchStoreAccount } from '../payment';
import { useAttachments } from '../useAttachments';
import { ImportReview } from './ImportReview';

type Props = {
  today: string;
  accounts: readonly Account[];
  categories: readonly Category[];
  aliases: Aliases;
  balances: ReadonlyMap<string, number> | undefined;
};

/**
 * AI入力: レシート・明細の写真や CSV・JSON などのファイルから、AI が記録を読み取る。
 * 読み取った記録は一覧（ImportReview）で確かめてから保存する（同じ日・同じ金額の記録があれば重複として最初は外す）。
 * 途中でアプリを閉じても、次に開いたときに続きから読み取る・一覧を出す（importJob.ts）
 */
export function AiImport({ today, accounts, categories, aliases, balances }: Props) {
  const files = useAttachments();
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fallback, setFallback] = useState<FallbackAccounts>({ payFrom: null, payTo: null });
  const create = useCreateTransactions();
  const [saved, setSaved] = useState<number | null>(null);

  /** 送る内容（job）を読み取って一覧を出す。読み取れたら一覧も端末に置き、駄目なら置いたものを消す */
  const extract = async (job: ImportJob) => {
    setReading(true);
    files.setError(null);
    try {
      const accountLikes = accounts.map((a) => ({ id: a.id, kind: a.kind, isArchived: a.is_archived, isReserved: a.is_reserved }));
      const { records } = await extractRecords(
        extractPrompt(job.today, accountLikes, categories, aliases),
        job.texts,
        job.binaries,
      );
      const found = toDrafts(records, accounts, categories, aliases);
      if (found.length === 0) {
        clearImportJob();
        files.setError('記録を読み取れませんでした');
        return;
      }
      // 重複は前後1日まで見るので、その分だけ広く読む
      const dates = found.map((d) => d.date).sort();
      const existing = await fetchDateAmountsBetween(addDays(dates[0], -1), addDays(dates[dates.length - 1], 1));
      // 支払いの口座: 書かれた支払い方法から決め、分からないセルフレジの画面・自販機は現金とみなす
      const cash = defaultCashAccount(accounts);
      const marked = assignPaymentAccounts(
        markDuplicates(found, existing),
        (payment) => matchPaymentAccount(payment, accounts),
        cash,
        (payee) => matchStoreAccount(payee, accounts),
      );
      const picked = marked.filter((d) => !d.duplicate).map((d) => d.key);
      saveImportJob({ ...job, drafts: marked, selected: picked });
      setDrafts(marked);
      setSelected(new Set(picked));
    } catch (e) {
      // 混み合い・通信の失敗は置いたままにして、次に開いたときに読み取り直す
      if (!(e instanceof AiError && e.temporary)) clearImportJob();
      files.setError(e instanceof AiError ? e.message : '読み取れませんでした');
    } finally {
      setReading(false);
    }
  };

  const read = () => {
    const job: ImportJob = {
      today,
      texts: [
        ...files.attachments.flatMap((a) => (a.kind === 'text' ? [`# ${a.name}\n${a.text}`] : [])),
        text.trim(),
      ]
        .filter(Boolean)
        .join('\n\n'),
      binaries: files.attachments.flatMap((a) => (a.kind === 'file' ? [{ mimeType: a.mimeType, data: a.data }] : [])),
      savedAt: Date.now(),
    };
    saveImportJob(job);
    extract(job);
  };

  // 前に閉じたときの続き: 一覧まで進んでいればそのまま出し、読み取りの途中なら読み取り直す
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    loadImportJob().then((job) => {
      if (!job) return;
      if (job.drafts) {
        setDrafts(job.drafts);
        setSelected(new Set(job.selected ?? []));
      } else {
        extract(job);
      }
    });
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const rows = (drafts ?? []).filter((d) => selected.has(d.key) && isDraftReady(d, fallback));
    try {
      await create.mutateAsync(rows.map((d) => draftToRow(d, fallback, today)));
      setSaved(rows.length);
      clearImportJob();
      setDrafts(null);
      files.clear();
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {drafts === null ? (
          <>
            <View style={styles.buttons}>
              <Button mode="outlined" icon="camera" onPress={() => files.addImage(true)} disabled={reading}>
                写真を撮る
              </Button>
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
              disabled={reading || (files.attachments.length === 0 && text.trim() === '')}
            >
              読み取る
            </Button>
            {files.error && <HelperText type="error">{files.error}</HelperText>}
          </>
        ) : (
          <ImportReview
            drafts={drafts}
            selected={selected}
            onToggle={toggle}
            fallback={fallback}
            onFallbackChange={setFallback}
            accounts={accounts}
            categories={categories}
            balances={balances}
            saving={create.isPending}
            onSave={save}
            onBack={() => {
              clearImportJob();
              setDrafts(null);
            }}
          />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, gap: SPACING.gap, paddingBottom: 48 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  text: { maxHeight: 160 },
});
