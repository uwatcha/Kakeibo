import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Snackbar, Switch, Text, TextInput, useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { type AccountKind, ASSET_KINDS } from '@/features/accounts/accountKinds';
import { useAccounts } from '@/features/accounts/hooks';
import { startBackgroundTask } from '@/features/background/backgroundTask';
import { useCategories } from '@/features/categories/hooks';
import { categoryLabel } from '@/features/categories/tree';
import { EMAIL_IMPORT_ENDPOINT, type PayeeRule } from '@/features/emailImport/api';
import { buildAppsScript } from '@/features/emailImport/appsScript';
import {
  useDeletePayeeRule,
  useEmailImportSettings,
  useEmailImportSources,
  usePayeeRules,
  useRotateToken,
  useSaveEmailImportSource,
  useSaveSummaryRules,
  useUpdatePayeeRule,
} from '@/features/emailImport/hooks';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { CategoryPicker } from '@/features/transactions/components/CategoryPicker';
import { SPACING } from '@/theme';

import type { EmailSource } from '../../supabase/functions/_shared/emailParse';
import { DEFAULT_SUMMARY_RULES } from '../../supabase/functions/_shared/emailRules';

const SOURCES: { source: EmailSource; label: string; kinds: readonly AccountKind[] }[] = [
  { source: 'debit_mail', label: 'サンプルデビット', kinds: ASSET_KINDS },
  { source: 'bank_mail', label: 'サンプル銀行の入出金（連携サービス）', kinds: ASSET_KINDS },
  { source: 'card_mail', label: 'サンプルカード', kinds: ['credit_card'] },
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 設定 > メールからの記録。メールの種類ごとのオンオフと口座、Apps Script との連携、内容の要約ルール、利用先の対応表 */
export default function EmailImportScreen() {
  const theme = useTheme();
  const settings = useEmailImportSettings();
  const sources = useEmailImportSources();
  const rules = usePayeeRules();
  const accounts = useAccounts();
  const categories = useCategories();
  const saveSource = useSaveEmailImportSource();
  const rotate = useRotateToken();
  const saveRules = useSaveSummaryRules();
  const updateRule = useUpdatePayeeRule();
  const deleteRule = useDeletePayeeRule();

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [rulesDraft, setRulesDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rule: PayeeRule; payee: string; categoryId: string | null } | null>(null);

  const queries = [settings, sources, rules, accounts, categories];
  if (queries.some((q) => q.data === undefined)) {
    const error = queries.find((q) => q.error)?.error ?? null;
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'メールからの記録' }} />
        <QueryState isLoading={!error} error={error} onRetry={() => queries.forEach((q) => q.refetch())} />
      </View>
    );
  }

  const linked = !!settings.data?.token_hash;
  const currentRules = settings.data?.summary_rules ?? DEFAULT_SUMMARY_RULES;
  const failed = saveSource.isError || rotate.isError || saveRules.isError || updateRule.isError || deleteRule.isError;

  const createToken = async () => {
    setConfirmRotate(false);
    try {
      setToken(await rotate.mutateAsync());
      // 自動で入った記録を通知するため、バックグラウンドの確認を始める
      startBackgroundTask();
    } catch {
      // Snackbar で知らせる
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'メールからの記録' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionCard title="メールの種類">
          {SOURCES.map(({ source, label, kinds }) => {
            const row = sources.data!.find((s) => s.source === source);
            const enabled = row?.enabled ?? false;
            const accountId = row?.account_id ?? null;
            return (
              <View key={source}>
                <ListRow
                  title={label}
                  icon="email-outline"
                  right={
                    <Switch
                      value={enabled}
                      onValueChange={(next) => saveSource.mutate({ source, enabled: next, accountId })}
                    />
                  }
                  onPress={() => saveSource.mutate({ source, enabled: !enabled, accountId })}
                />
                {enabled && (
                  <View style={styles.picker}>
                    <AccountPicker
                      label="口座"
                      kinds={kinds}
                      accounts={accounts.data!}
                      value={accountId}
                      onChange={(id) => saveSource.mutate({ source, enabled, accountId: id })}
                      error={accountId ? undefined : '口座を選んでください'}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </SectionCard>

        <SectionCard title="Gmail との連携">
          <ListRow
            title={linked ? '合言葉を作り直す' : '合言葉を作る'}
            subtitle={
              settings.data?.last_seen_at ? `最後に届いた時刻: ${formatTime(settings.data.last_seen_at)}` : undefined
            }
            icon="key-variant"
            onPress={() => (linked ? setConfirmRotate(true) : createToken())}
            disabled={rotate.isPending}
          />
        </SectionCard>

        <SectionCard title="内容の要約ルール">
          <ListRow
            title={settings.data?.summary_rules ? '自分で書いたルール' : '初期のルール'}
            subtitle={currentRules.split('\n')[0]}
            icon="text-box-edit-outline"
            onPress={() => setRulesDraft(currentRules)}
          />
        </SectionCard>

        <SectionCard title={`利用先の対応表（${rules.data!.length}件）`}>
          {rules.data!.length === 0 ? (
            <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              対応表はまだありません
            </Text>
          ) : (
            rules.data!.map((rule) => (
              <ListRow
                key={rule.raw_payee}
                title={rule.payee ?? rule.raw_payee}
                subtitle={[rule.raw_payee, categoryLabel(rule.category_id, categories.data!) ?? '未分類'].join('・')}
                icon={rule.learned_from === 'user' ? 'account-edit-outline' : 'robot-outline'}
                wrap
                onPress={() => setEditing({ rule, payee: rule.payee ?? '', categoryId: rule.category_id })}
              />
            ))
          )}
        </SectionCard>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmRotate} onDismiss={() => setConfirmRotate(false)}>
          <Dialog.Title>合言葉を作り直しますか？</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">今の合言葉は使えなくなります。Apps Script のコードも貼り直してください。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmRotate(false)}>キャンセル</Button>
            <Button onPress={createToken}>作り直す</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={token !== null} onDismiss={() => setToken(null)}>
          <Dialog.Title>合言葉</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <Text variant="bodyMedium" selectable style={styles.token}>
              {token}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setToken(null)}>閉じる</Button>
            <Button
              icon="share-variant"
              onPress={() => token && Share.share({ message: buildAppsScript(EMAIL_IMPORT_ENDPOINT, token) })}
            >
              Apps Script のコードを共有
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={rulesDraft !== null} onDismiss={() => setRulesDraft(null)}>
          <Dialog.Title>内容の要約ルール</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput mode="outlined" multiline value={rulesDraft ?? ''} onChangeText={setRulesDraft} />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              onPress={() => {
                saveRules.mutate(null);
                setRulesDraft(null);
              }}
            >
              初期に戻す
            </Button>
            <Button
              disabled={!rulesDraft?.trim()}
              onPress={() => {
                saveRules.mutate(rulesDraft!.trim() === DEFAULT_SUMMARY_RULES ? null : rulesDraft!.trim());
                setRulesDraft(null);
              }}
            >
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={editing !== null} onDismiss={() => setEditing(null)}>
          <Dialog.Title>{editing?.rule.raw_payee}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialog}>
              <TextInput
                mode="outlined"
                label="内容"
                value={editing?.payee ?? ''}
                onChangeText={(payee) => editing && setEditing({ ...editing, payee })}
              />
              {editing && (
                <CategoryPicker
                  kind={editing.rule.kind}
                  categories={categories.data!}
                  value={editing.categoryId}
                  onChange={(categoryId) => setEditing({ ...editing, categoryId })}
                />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                if (editing) deleteRule.mutate(editing.rule.raw_payee);
                setEditing(null);
              }}
            >
              削除
            </Button>
            <Button
              onPress={() => {
                if (editing)
                  updateRule.mutate({
                    rawPayee: editing.rule.raw_payee,
                    payee: editing.payee.trim() || null,
                    categoryId: editing.categoryId,
                  });
                setEditing(null);
              }}
            >
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={failed}
        onDismiss={() => [saveSource, rotate, saveRules, updateRule, deleteRule].forEach((m) => m.reset())}
      >
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 48 },
  picker: { paddingHorizontal: SPACING.row, paddingBottom: 8 },
  empty: { padding: 16, textAlign: 'center' },
  dialog: { gap: 8 },
  token: { fontFamily: 'monospace' },
  scrollArea: { maxHeight: 420, paddingHorizontal: 24 },
});
