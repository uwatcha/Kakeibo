import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Snackbar, Switch, Text, useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { QueriesState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { type AccountKind, ASSET_KINDS } from '@/features/accounts/accountKinds';
import { useAccounts } from '@/features/accounts/hooks';
import { startBackgroundTask } from '@/features/background/backgroundTask';
import { useCategories } from '@/features/categories/hooks';
import { categoryLabel } from '@/features/categories/tree';
import type { PayeeRule } from '@/features/emailImport/api';
import { PayeeRuleDialog } from '@/features/emailImport/components/PayeeRuleDialog';
import { TokenDialog } from '@/features/emailImport/components/TokenDialog';
import {
  useDeletePayeeRule,
  useEmailImportSettings,
  useEmailImportSources,
  usePayeeRules,
  useRotateToken,
  useSaveEmailImportSource,
  useSaveAtmCashAccount,
  useUpdatePayeeRule,
} from '@/features/emailImport/hooks';
import { AccountPicker } from '@/features/transactions/components/AccountPicker';
import { MAIL_NAMES } from '@/lib/personal';
import { SPACING } from '@/theme';

import type { EmailSource } from '../../supabase/functions/_shared/emailParse';
import { DEFAULT_SUMMARY_RULES } from '../../supabase/functions/_shared/emailRules';

const SOURCES: { source: EmailSource; label: string; kinds: readonly AccountKind[] }[] = [
  { source: 'debit_mail', label: MAIL_NAMES.debit, kinds: ASSET_KINDS },
  { source: 'bank_mail', label: `${MAIL_NAMES.bank}の入出金（${MAIL_NAMES.bankService}）`, kinds: ASSET_KINDS },
  { source: 'card_mail', label: MAIL_NAMES.card, kinds: ['credit_card'] },
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 設定 > メールからの記録。メールの種類ごとのオンオフと口座、Apps Script との連携、自動入力のルール、利用先の対応表 */
export default function EmailImportScreen() {
  const theme = useTheme();
  const settings = useEmailImportSettings();
  const sources = useEmailImportSources();
  const rules = usePayeeRules();
  const accounts = useAccounts();
  const categories = useCategories();
  const saveSource = useSaveEmailImportSource();
  const saveAtmCash = useSaveAtmCashAccount();
  const rotate = useRotateToken();
  const updateRule = useUpdatePayeeRule();
  const deleteRule = useDeletePayeeRule();

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<PayeeRule | null>(null);

  const queries = [settings, sources, rules, accounts, categories];
  if (queries.some((q) => q.data === undefined)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'メールからの記録' }} />
        <QueriesState queries={queries} />
      </View>
    );
  }

  const linked = !!settings.data?.token_hash;
  const currentRules = settings.data?.summary_rules ?? DEFAULT_SUMMARY_RULES;
  const failed = saveSource.isError || rotate.isError || updateRule.isError || deleteRule.isError;

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
                    {/* ATM の引き出し・預け入れを振り替える現金の口座（選ばなければ、いちばん先に作った現金の口座） */}
                    {source === 'bank_mail' && (
                      <AccountPicker
                        label="ATM の現金"
                        kinds={['cash']}
                        accounts={accounts.data!}
                        value={settings.data?.atm_cash_account_id ?? null}
                        onChange={(id) => saveAtmCash.mutate(id)}
                      />
                    )}
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

        <SectionCard title="自動入力のルール">
          <ListRow
            title={settings.data?.summary_rules ? '自分で書いたルール' : '初期のルール'}
            subtitle={currentRules.split('\n')[0]}
            icon="text-box-edit-outline"
            onPress={() => router.push('/auto-rules')}
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
                onPress={() => setEditing(rule)}
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

        <TokenDialog token={token} onClose={() => setToken(null)} />
        {editing && (
          <PayeeRuleDialog
            key={editing.raw_payee}
            rule={editing}
            categories={categories.data!}
            onDismiss={() => setEditing(null)}
            onSave={(values) => {
              updateRule.mutate({ rawPayee: editing.raw_payee, ...values });
              setEditing(null);
            }}
            onDelete={() => {
              deleteRule.mutate(editing.raw_payee);
              setEditing(null);
            }}
          />
        )}
      </Portal>

      <Snackbar
        visible={failed}
        onDismiss={() => [saveSource, rotate, updateRule, deleteRule].forEach((m) => m.reset())}
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
});
