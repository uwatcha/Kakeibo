import { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

import { RADIUS, SPACING } from '@/theme';

import type { PendingSend } from '../pendingSend';
import type { ChatItem } from '../useChatSender';
import { MarkdownText } from './MarkdownText';

type Props = {
  items: readonly ChatItem[];
  /** 一番上の、会話が消える・残ることの表示 */
  header: string;
  /** 返事を待っている（送り直し中でない） */
  thinking: boolean;
  retry: { count: number } | null;
  onCancelRetry: () => void;
  /** 画面を閉じたあとも送り直しを待っている質問 */
  waiting: readonly PendingSend[];
  onCancelWaiting: (item: PendingSend) => void;
  error: string | null;
};

function Bubble({ role, children }: { role: 'user' | 'model'; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        role === 'user'
          ? [styles.userBubble, { backgroundColor: theme.colors.primaryContainer }]
          : [styles.modelBubble, { backgroundColor: theme.colors.surface }],
      ]}
    >
      {children}
    </View>
  );
}

function RetryRow({ label, onCancel }: { label: string; onCancel: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.retry}>
      <ActivityIndicator size="small" />
      <Text variant="bodySmall" style={[styles.retryText, { color: theme.colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Button compact onPress={onCancel}>
        やめる
      </Button>
    </View>
  );
}

/** AI 相談のやりとりの一覧。追加されたら一番下までスクロールする */
export function ChatMessages({
  items,
  header,
  thinking,
  retry,
  onCancelRetry,
  waiting,
  onCancelWaiting,
  error,
}: Props) {
  const theme = useTheme();
  const listRef = useRef<FlatList<ChatItem>>(null);
  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.messages}
      ListHeaderComponent={
        <Text variant="labelSmall" style={[styles.header, { color: theme.colors.onSurfaceVariant }]}>
          {header}
        </Text>
      }
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => (
        <Bubble role={item.role}>
          {item.role === 'model' ? (
            // AI の返事は Markdown（見出し・太字・箇条書き・表）として表示する
            <MarkdownText>{item.shown}</MarkdownText>
          ) : (
            <Text variant="bodyMedium" selectable>
              {item.shown}
            </Text>
          )}
        </Bubble>
      )}
      ListFooterComponent={
        <>
          {thinking && <ActivityIndicator style={styles.thinking} />}
          {retry && (
            <RetryRow label={`混み合っているので送り直しています（${retry.count}回目）`} onCancel={onCancelRetry} />
          )}
          {waiting.map((p) => (
            <View key={p.id} style={styles.waiting}>
              <Bubble role="user">
                <Text variant="bodyMedium">{p.question.shown}</Text>
              </Bubble>
              <RetryRow label="送り直し待ち（返事が来たら通知）" onCancel={() => onCancelWaiting(p)} />
            </View>
          ))}
          {error && (
            <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  messages: { padding: SPACING.screen, gap: 10 },
  header: { textAlign: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.tile },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  modelBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  thinking: { alignSelf: 'flex-start', marginLeft: 8 },
  error: { textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  retryText: { flex: 1 },
  waiting: { gap: 6 },
});
