import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Snackbar, Text, useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import type { Conversation } from '@/features/ai/api';
import { useConversations, useDeleteConversation, useSetConversationPinned } from '@/features/ai/hooks';
import { daysUntilDeletion, RETENTION_DAYS } from '@/features/ai/retention';
import { SPACING } from '@/theme';

/** AI 相談の会話の履歴。ピン留めした会話は残り、それ以外は最後のやりとりから14日で消える */
export default function AiHistoryScreen() {
  const theme = useTheme();
  const conversations = useConversations();
  const pin = useSetConversationPinned();
  const remove = useDeleteConversation();
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const now = new Date();

  const headerRight = () => (
    <IconButton icon="cog" accessibilityLabel="AI 相談の設定" onPress={() => router.push('/ai-settings')} />
  );

  if (!conversations.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '会話の履歴', headerRight }} />
        <QueryState isLoading={conversations.isLoading} error={conversations.error} onRetry={conversations.refetch} />
      </View>
    );
  }

  const pinned = conversations.data.filter((c) => c.pinned);
  const recent = conversations.data.filter((c) => !c.pinned);

  const row = (c: Conversation) => (
    <ListRow
      key={c.id}
      title={c.title}
      subtitle={c.pinned ? 'ピン留め中' : `あと${daysUntilDeletion(c.updated_at, now)}日で削除`}
      icon="chat-outline"
      right={
        <IconButton
          icon={c.pinned ? 'pin' : 'pin-outline'}
          iconColor={c.pinned ? theme.colors.primary : theme.colors.onSurfaceVariant}
          accessibilityLabel={c.pinned ? 'ピン留めを外す' : 'ピン留めする'}
          onPress={() => pin.mutate({ id: c.id, pinned: !c.pinned })}
          style={styles.pin}
        />
      }
      onPress={() => router.navigate({ pathname: '/ai', params: { c: c.id } })}
      onLongPress={() => setDeleting(c)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '会話の履歴', headerRight }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodySmall" style={[styles.notice, { color: theme.colors.onSurfaceVariant }]}>
          ピン留めしていない会話は、最後のやりとりから{RETENTION_DAYS}日で消えます
        </Text>
        {conversations.data.length === 0 && (
          <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            会話はまだありません
          </Text>
        )}
        {pinned.length > 0 && <SectionCard title="ピン留め">{pinned.map(row)}</SectionCard>}
        {recent.length > 0 && <SectionCard title="最近">{recent.map(row)}</SectionCard>}
      </ScrollView>

      <Portal>
        <Dialog visible={!!deleting} onDismiss={() => setDeleting(null)}>
          <Dialog.Title>会話を削除</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">「{deleting?.title}」を削除します。元に戻せません。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(null)}>キャンセル</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                if (deleting) remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              削除
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={pin.isError || remove.isError} onDismiss={() => (pin.reset(), remove.reset())}>
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 48 },
  notice: { paddingHorizontal: 4 },
  empty: { padding: 24, textAlign: 'center' },
  pin: { margin: -6 },
});
