import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ActivityIndicator, Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QueryState } from '@/components/QueryState';
import { useAccountBalances } from '@/features/accounts/hooks';
import { buildAliases, buildContext, maskText, restoreText, SYSTEM_PROMPT } from '@/features/ai/anonymize';
import { type AiMessage, sendAiChat } from '@/features/ai/api';
import { aiKeys, useAiStatus, useAiUsageToday } from '@/features/ai/hooks';
import { useCategories } from '@/features/categories/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { useRules } from '@/features/recurring/hooks';
import { fetchTransactionsSince } from '@/features/transactions/api';
import { addDays, toTokyoDateString } from '@/lib/date';
import { RADIUS, SPACING } from '@/theme';

/** AI に渡す記録の期間（日） */
const CONTEXT_DAYS = 90;

type ChatItem = {
  id: number;
  role: 'user' | 'model';
  /** 画面に出す文（元の名前） */
  shown: string;
  /** AI に送る・AI から来た文（置き換え後の名前） */
  sent: string;
};

/** 返事の「**太字**」などの記号は、そのままだと読みにくいので外す */
const plain = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();

/** 出納の記録をもとに、家計の相談に乗る AI（Gemini）とのチャット */
export default function AiChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = toTokyoDateString();
  const status = useAiStatus();
  const usage = useAiUsageToday(today);
  const balances = useAccountBalances();
  const categories = useCategories();
  const employers = useEmployers();
  const rules = useRules();
  const since = addDays(today, -CONTEXT_DAYS);
  const transactions = useQuery({
    queryKey: [...aiKeys.all, 'transactions', since],
    queryFn: () => fetchTransactionsSince(since),
  });

  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTotal, setLastTotal] = useState<number | null>(null);
  const nextId = useRef(1);
  const listRef = useRef<FlatList<ChatItem>>(null);

  const headerRight = () => (
    <View style={styles.headerRight}>
      <IconButton
        icon="broom"
        accessibilityLabel="新しい会話"
        disabled={items.length === 0 || sending}
        onPress={() => {
          setItems([]);
          setLastTotal(null);
          setError(null);
        }}
      />
      <IconButton icon="cog" accessibilityLabel="AI 相談の設定" onPress={() => router.push('/ai-settings')} />
    </View>
  );

  const sources = [status, balances, categories, employers, rules, transactions];
  const loadError = sources.find((q) => q.error)?.error ?? null;
  if (sources.some((q) => !q.data)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'AI 相談', headerRight }} />
        <QueryState isLoading={!loadError} error={loadError} onRetry={() => sources.forEach((q) => q.refetch())} />
      </View>
    );
  }

  if (!status.data!.hasKey) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'AI 相談', headerRight }} />
        <Button mode="contained" icon="link" onPress={() => router.push('/ai-settings')}>
          Gemini と連携する
        </Button>
      </View>
    );
  }

  const model = status.data!.models.find((m) => m.id === status.data!.model);
  const limit = model?.inputTokenLimit ?? 0;

  // 送るたびに今の記録から材料を作り直す（名前は置き換え済み）
  const source = {
    today,
    accounts: balances.data!.filter((a) => !a.isArchived),
    categories: categories.data!,
    employers: employers.data!,
    transactions: transactions.data!,
    rules: rules.data!,
  };
  const aliases = buildAliases(source);

  const send = async () => {
    const text = input.trim();
    if (text === '' || sending) return;
    const userItem: ChatItem = { id: nextId.current++, role: 'user', shown: text, sent: maskText(text, aliases) };
    const history = [...items, userItem];
    setItems(history);
    setInput('');
    setError(null);
    setSending(true);
    try {
      const system = `${SYSTEM_PROMPT}\n\n# 家計の材料\n${buildContext(source, aliases)}`;
      const messages: AiMessage[] = history.map((m) => ({ role: m.role, text: m.sent }));
      const reply = await sendAiChat(system, messages);
      setItems([
        ...history,
        { id: nextId.current++, role: 'model', shown: plain(restoreText(reply.text, aliases)), sent: reply.text },
      ]);
      setLastTotal(reply.usage.total);
      usage.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : '送れませんでした');
      // 送れなかった質問は入力欄に戻す
      setItems(items);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const remaining = lastTotal === null ? limit : Math.max(0, limit - lastTotal);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'AI 相談', headerRight }} />
      <View style={[styles.meter, { backgroundColor: theme.colors.surface }]}>
        <Text variant="labelMedium" numberOfLines={1} style={styles.meterModel}>
          {model?.label ?? status.data!.model}
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          この会話の残り {remaining.toLocaleString('ja-JP')} / {limit.toLocaleString('ja-JP')} トークン
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          今日 {usage.data?.count ?? 0}回・{(usage.data?.tokens ?? 0).toLocaleString('ja-JP')} トークン使用
        </Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.container} keyboardVerticalOffset={insets.top + 56}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user'
                  ? [styles.userBubble, { backgroundColor: theme.colors.primaryContainer }]
                  : [styles.modelBubble, { backgroundColor: theme.colors.surface }],
              ]}
            >
              <Text variant="bodyMedium" selectable>
                {item.shown}
              </Text>
            </View>
          )}
          ListFooterComponent={
            <>
              {sending && <ActivityIndicator style={styles.thinking} />}
              {error && (
                <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
                  {error}
                </Text>
              )}
            </>
          }
        />
        <View
          style={[
            styles.inputBar,
            { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <TextInput
            mode="outlined"
            placeholder="家計について聞く"
            value={input}
            onChangeText={setInput}
            multiline
            dense
            style={styles.input}
          />
          <IconButton
            icon="send"
            mode="contained"
            accessibilityLabel="送る"
            disabled={input.trim() === '' || sending}
            onPress={send}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row' },
  meter: {
    marginHorizontal: SPACING.screen,
    marginTop: 4,
    paddingHorizontal: SPACING.row,
    paddingVertical: 8,
    borderRadius: RADIUS.tile,
    gap: 2,
  },
  meterModel: { fontWeight: '700' },
  messages: { padding: SPACING.screen, gap: 10 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.tile },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  modelBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  thinking: { alignSelf: 'flex-start', marginLeft: 8 },
  error: { textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  input: { flex: 1, maxHeight: 120 },
});
