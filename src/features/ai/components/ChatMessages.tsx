import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';

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

/** 一番下からこれ以内なら、一番下を見ているとみなす */
const BOTTOM_SLACK = 80;

const jpeg = (data: string) => ({ uri: `data:image/jpeg;base64,${data}` });

/** 質問に添えた画像の小さな絵。押すと大きく出す */
function Thumbnails({ images, onOpen }: { images: readonly string[]; onOpen: (data: string) => void }) {
  return (
    <View style={styles.thumbs}>
      {images.map((data, i) => (
        <Pressable key={i} accessibilityLabel={`添えた画像${i + 1}`} onPress={() => onOpen(data)}>
          <Image source={jpeg(data)} style={styles.thumb} />
        </Pressable>
      ))}
    </View>
  );
}

/** 吹き出しの文をまるごとコピーするボタン（2026-11-24 ユーザーの要望）。押すと少しの間チェックの印になる */
function CopyButton({ text, role }: { text: string; role: 'user' | 'model' }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? 'check' : 'content-copy'}
      size={16}
      iconColor={theme.colors.onSurfaceVariant}
      accessibilityLabel={role === 'user' ? '質問をコピー' : '返事をコピー'}
      style={[styles.copy, role === 'user' ? styles.copyUser : styles.copyModel]}
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    />
  );
}

/** AI 相談のやりとりの一覧。追加されたら一番下までスクロールする（上へ遡っている間は戻さない） */
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
  /**
   * 一番下までスクロールするのは、やりとりが増えたときと、一番下を見ているときだけ（2026-11-24: 高さが変わるたびに
   * 下へ戻していたので、上へ遡ると、表示の外の吹き出しを描き直すたびに一番下に戻された）
   */
  const shownKey = useRef('');
  const atBottom = useRef(true);
  // 大きく出している画像
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <>
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
        onContentSizeChange={() => {
          // 数と先頭のやりとりで見分ける（ほかの会話に切り替えたときも一番下へ）
          const shown = `${items.length}:${items[0]?.id ?? ''}`;
          if (shown === shownKey.current && !atBottom.current) return;
          shownKey.current = shown;
          listRef.current?.scrollToEnd({ animated: true });
        }}
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < BOTTOM_SLACK;
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => (
          <View>
            <Bubble role={item.role}>
              {item.role === 'model' ? (
                // AI の返事は Markdown（見出し・太字・箇条書き・表）として表示する
                <MarkdownText>{item.shown}</MarkdownText>
              ) : (
                <>
                  {!!item.images?.length && <Thumbnails images={item.images} onOpen={setViewing} />}
                  {item.shown !== '' && (
                    <Text variant="bodyMedium" selectable>
                      {item.shown}
                    </Text>
                  )}
                </>
              )}
            </Bubble>
            {item.shown !== '' && item.id !== 'pending' && <CopyButton text={item.shown} role={item.role} />}
          </View>
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
                  {!!p.question.images?.length && <Thumbnails images={p.question.images} onOpen={setViewing} />}
                  {p.question.shown !== '' && <Text variant="bodyMedium">{p.question.shown}</Text>}
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
      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} accessibilityLabel="閉じる" onPress={() => setViewing(null)}>
          {viewing && <Image source={jpeg(viewing)} style={styles.full} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { margin: 0, marginTop: 2 },
  copyUser: { alignSelf: 'flex-end' },
  copyModel: { alignSelf: 'flex-start' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  thumb: { width: 96, height: 96, borderRadius: 8 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' },
  full: { width: '100%', height: '100%' },
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
