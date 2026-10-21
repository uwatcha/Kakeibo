import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ActivityIndicator, Button, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QueryState } from '@/components/QueryState';
import { useAccountBalances } from '@/features/accounts/hooks';
import { buildAliases, buildContext, maskText, restoreText, SYSTEM_PROMPT } from '@/features/ai/anonymize';
import {
  AiError,
  type AiMessage,
  appendExchange,
  createConversation,
  fetchConversation,
  sendAiChat,
} from '@/features/ai/api';
import { AutoTitler } from '@/features/ai/components/AutoTitler';
import { MarkdownText } from '@/features/ai/components/MarkdownText';
import { TokenGauge } from '@/features/ai/components/TokenGauge';
import { aiKeys, useAiStatus, useAiUsageToday, useConversation, useConversations } from '@/features/ai/hooks';
import { daysUntilDeletion, RETENTION_DAYS, titleFrom } from '@/features/ai/retention';
import { useCategories } from '@/features/categories/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { useRules } from '@/features/recurring/hooks';
import { fetchTransactionsSince } from '@/features/transactions/api';
import { addDays, toTokyoDateString } from '@/lib/date';
import { RADIUS, SPACING } from '@/theme';

/** 混み合いで送れなかったときに送り直す間隔と回数（30秒ごと・最大20回 = 10分） */
const RETRY_INTERVAL_MS = 30_000;
const MAX_RETRIES = 20;

/** AI に渡す記録の期間（日） */
const CONTEXT_DAYS = 90;

type ChatItem = {
  id: number | string;
  role: 'user' | 'model';
  /** 画面に出す文（元の名前） */
  shown: string;
  /** AI に送る・AI から来た文（置き換え後の名前） */
  sent: string;
};

/**
 * 出納の記録をもとに、家計の相談に乗る AI（Gemini）とのチャット。
 * 会話は保存し、URL の c に開いている会話の id を持つ（なければ新しいチャット）
 */
export default function AiChatScreen() {
  const { c: conversationId } = useLocalSearchParams<{ c?: string }>();
  const conversation = useConversation(conversationId);
  // 開いたときに、期限が過ぎたピン留めなしの会話を消しておく（一覧の読み込みで消える）
  const conversations = useConversations();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = toTokyoDateString();
  const status = useAiStatus();
  const queryClient = useQueryClient();
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

  // 返事を待っている間の質問（保存は返事と一緒にする）
  const [pending, setPending] = useState<ChatItem | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatItem>>(null);
  // 混み合いで送れなかったとき、画面を開いている間は自動で送り直し続ける
  const [retry, setRetry] = useState<{ count: number; text: string } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  const stored: ChatItem[] = conversationId ? (conversation.data?.messages ?? []) : [];
  const items = pending ? [...stored, pending] : stored;
  const lastTotal = conversationId ? (conversation.data?.conversation.last_total_tokens ?? 0) : 0;

  // 右上の小さな円のゲージ（この会話で使ったトークン）。連携していて、モデルが分かるときだけ
  const currentModel = status.data?.models.find((m) => m.id === status.data?.model);
  const gauge =
    status.data?.hasKey && currentModel ? (
      <TokenGauge
        modelLabel={currentModel.label}
        used={lastTotal}
        limit={currentModel.inputTokenLimit}
        todayCount={usage.data?.count ?? 0}
        todayTokens={usage.data?.tokens ?? 0}
      />
    ) : null;

  const headerRight = () => (
    <View style={styles.headerRight}>
      {gauge}
      <IconButton icon="history" accessibilityLabel="会話の履歴" onPress={() => router.push('/ai-history')} />
      <IconButton
        icon="square-edit-outline"
        accessibilityLabel="新しいチャット"
        disabled={!conversationId || sending}
        onPress={() => {
          setError(null);
          router.setParams({ c: undefined });
        }}
      />
    </View>
  );

  const sources = [
    status,
    balances,
    categories,
    employers,
    rules,
    transactions,
    ...(conversationId ? [conversation] : []),
  ];
  const loadError = sources.find((q) => q.error)?.error ?? null;
  if (sources.some((q) => !q.data)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Tabs.Screen options={{ headerRight }} />
        <QueryState isLoading={!loadError} error={loadError} onRetry={() => sources.forEach((q) => q.refetch())} />
      </View>
    );
  }

  if (!status.data!.hasKey) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Tabs.Screen options={{ headerRight }} />
        <Button mode="contained" icon="link" onPress={() => router.push('/ai-settings')}>
          Gemini と連携する
        </Button>
      </View>
    );
  }

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

  const finish = () => {
    setRetry(null);
    setPending(null);
    setSending(false);
  };

  /** 送る。混み合いなどで失敗したら、30秒ごとに送り直す（最大 MAX_RETRIES 回） */
  const attempt = async (
    text: string,
    question: { shown: string; sent: string },
    history: ChatItem[],
    tries: number,
  ) => {
    try {
      const system = `${SYSTEM_PROMPT}\n\n# 家計の材料\n${buildContext(source, aliases)}`;
      const messages: AiMessage[] = history.map((m) => ({ role: m.role, text: m.sent }));
      const reply = await sendAiChat(system, messages);
      // 質問と返事を保存する。初めての質問なら会話を作る
      const id = conversationId ?? (await createConversation(titleFrom(text)));
      await appendExchange(
        id,
        question,
        { shown: restoreText(reply.text, aliases), sent: reply.text },
        reply.usage.total,
      );
      // 読み直してから開く（新しい会話でも読み込み中の画面を挟まない）
      await queryClient.fetchQuery({ queryKey: aiKeys.conversation(id), queryFn: () => fetchConversation(id) });
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
      if (!conversationId) router.setParams({ c: id });
      usage.refetch();
      // 使えなくなったモデルからサーバーが自動で切り替えたときは、表示のモデルも読み直す
      if (reply.model !== status.data?.model) queryClient.invalidateQueries({ queryKey: aiKeys.status() });
      finish();
    } catch (e) {
      if (e instanceof AiError && e.temporary && tries < MAX_RETRIES) {
        setRetry({ count: tries + 1, text });
        retryTimer.current = setTimeout(() => attempt(text, question, history, tries + 1), RETRY_INTERVAL_MS);
        return;
      }
      setError(e instanceof Error ? e.message : '送れませんでした');
      // 送れなかった質問は入力欄に戻す
      setInput(text);
      finish();
    }
  };

  const send = () => {
    const text = input.trim();
    if (text === '' || sending) return;
    const question = { shown: text, sent: maskText(text, aliases) };
    const history = [...stored, { id: 'pending', role: 'user' as const, ...question }];
    setPending(history[history.length - 1]);
    setInput('');
    setError(null);
    setSending(true);
    attempt(text, question, history, 0);
  };

  const cancelRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (retry) setInput(retry.text);
    finish();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tabs.Screen options={{ headerRight }} />
      {conversations.data && <AutoTitler conversations={conversations.data} aliases={aliases} />}

      <KeyboardAvoidingView behavior="padding" style={styles.container} keyboardVerticalOffset={insets.top + 64}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messages}
          ListHeaderComponent={
            // ピン留めしていない会話は消えることを、開いている会話でも分かるようにする
            <Text variant="labelSmall" style={[styles.retention, { color: theme.colors.onSurfaceVariant }]}>
              {conversation.data?.conversation.pinned && conversationId
                ? 'ピン留め中の会話'
                : conversationId && conversation.data
                  ? `この会話はあと${daysUntilDeletion(conversation.data.conversation.updated_at, new Date())}日で消えます（履歴でピン留めすると残ります）`
                  : `会話は保存され、ピン留めしなければ${RETENTION_DAYS}日で消えます`}
            </Text>
          }
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
              {item.role === 'model' ? (
                // AI の返事は Markdown（見出し・太字・箇条書き・表）として表示する
                <MarkdownText>{item.shown}</MarkdownText>
              ) : (
                <Text variant="bodyMedium" selectable>
                  {item.shown}
                </Text>
              )}
            </View>
          )}
          ListFooterComponent={
            <>
              {sending && !retry && <ActivityIndicator style={styles.thinking} />}
              {retry && (
                <View style={styles.retry}>
                  <ActivityIndicator size="small" />
                  <Text variant="bodySmall" style={[styles.retryText, { color: theme.colors.onSurfaceVariant }]}>
                    混み合っているので送り直しています（{retry.count}回目）
                  </Text>
                  <Button compact onPress={cancelRetry}>
                    やめる
                  </Button>
                </View>
              )}
              {error && (
                <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
                  {error}
                </Text>
              )}
            </>
          }
        />
        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface }]}>
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
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  messages: { padding: SPACING.screen, gap: 10 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.tile },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  modelBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  thinking: { alignSelf: 'flex-start', marginLeft: 8 },
  error: { textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  retryText: { flex: 1 },
  retention: { textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  input: { flex: 1, maxHeight: 120 },
});
