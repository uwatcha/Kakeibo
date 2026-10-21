import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import type { Transaction } from '@/features/transactions/api';
import { amountKindOf } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';

import { useDeleteGenerated, useDeleteRule } from '../hooks';

type Props = {
  ruleId: string;
  generated: readonly Transaction[] | undefined;
  today: string;
  busy: boolean;
};

/** 定期支払いで追加した記録の一覧と、まとめて削除・ルールの削除（確かめるダイアログつき） */
export function GeneratedRecords({ ruleId, generated, today, busy }: Props) {
  const theme = useTheme();
  const deleteGenerated = useDeleteGenerated();
  const deleteRule = useDeleteRule();
  const [confirm, setConfirm] = useState<'generated' | 'rule' | null>(null);
  const deleting = deleteGenerated.isPending || deleteRule.isPending;
  const count = generated?.length ?? 0;

  return (
    <>
      <SectionCard title={`追加した記録（${count}件）`}>
        {generated?.map((t) => (
          <ListRow
            key={t.id}
            title={formatDay(t.date)}
            subtitle={t.date > today ? '予定' : undefined}
            right={<Amount value={t.amount} kind={amountKindOf(t.type)} variant="bodyLarge" />}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
          />
        ))}
      </SectionCard>
      <Button
        mode="outlined"
        icon="delete-sweep"
        textColor={theme.colors.error}
        disabled={busy || deleting || count === 0}
        onPress={() => setConfirm('generated')}
      >
        追加した記録をまとめて削除
      </Button>
      <Button
        mode="text"
        icon="delete"
        textColor={theme.colors.error}
        style={styles.button}
        disabled={busy || deleting}
        onPress={() => setConfirm('rule')}
      >
        この定期支払いを削除
      </Button>
      {(deleteGenerated.isError || deleteRule.isError) && (
        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
          削除できませんでした。通信状態を確認してください
        </Text>
      )}

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>
            {confirm === 'generated' ? `追加した記録 ${count}件を削除しますか？` : 'この定期支払いを削除しますか？'}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">削除すると元に戻せません。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>キャンセル</Button>
            <Button
              textColor={theme.colors.error}
              onPress={async () => {
                const target = confirm;
                setConfirm(null);
                try {
                  if (target === 'generated') await deleteGenerated.mutateAsync(ruleId);
                  else {
                    await deleteRule.mutateAsync(ruleId);
                    router.back();
                  }
                } catch {
                  // 上の文で知らせる
                }
              }}
            >
              削除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({ button: { marginTop: 8 } });
