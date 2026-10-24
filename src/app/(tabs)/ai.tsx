import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button, IconButton, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QueriesState } from '@/components/QueryState';
import { useAccountBalances, useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { buildAliases, maskText } from '@/features/ai/anonymize';
import { buildChatSystem } from '@/features/ai/chatContext';
import { AiImport } from '@/features/ai/components/AiImport';
import { AutoTitler } from '@/features/ai/components/AutoTitler';
import { loadImportJob } from '@/features/ai/importJob';
import { ChatMessages } from '@/features/ai/components/ChatMessages';
import { TokenGauge } from '@/features/ai/components/TokenGauge';
import {
  aiKeys,
  useAiStatus,
  useAiUsageToday,
  useConversation,
  useConversations,
  usePendingSends,
} from '@/features/ai/hooks';
import { takePending } from '@/features/ai/pendingSend';
import { daysUntilDeletion, RETENTION_DAYS } from '@/features/ai/retention';
import { type ChatItem, useChatSender } from '@/features/ai/useChatSender';
import { forgetLastConversation, useRestoreConversation } from '@/features/ai/useRestoreConversation';
import { useCategories } from '@/features/categories/hooks';
import { useEmployers } from '@/features/employers/hooks';
import { useHomeFigures } from '@/features/home/hooks';
import { useRules } from '@/features/recurring/hooks';
import { fetchTransactionsSince } from '@/features/transactions/api';
import { addDays, toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

/** AI に渡す記録の期間（日） */
const CONTEXT_DAYS = 90;
/** 相談・入力の切り替え（ボタンの高さ＋上の余白） */
const MODE_BAR_HEIGHT = 48;
/** トップバーの下の、会話のタイトルの帯の高さ */
const TITLE_BAR_HEIGHT = 36;

/**
 * AI のタブ。上の切り替えで「相談」（家計の相談に乗る AI（Gemini）とのチャット）と「入力」（AI入力）。
 * 会話は保存し、URL の c に開いている会話の id を持つ（なければ新しいチャット）。
 * 送信・送り直しは useChatSender、AI に渡す指示は chatContext.ts
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
  // AI入力で口座を選ぶため（記録の入力画面と同じ口座の一覧と残高）
  const accounts = useAccounts();
  const balanceMap = useBalanceMap();
  // ホームに出ている額も渡す（「ホームの〜」のような質問に、画面と同じ数字で答えられるように）
  const home = useHomeFigures(today);
  const categories = useCategories();
  const employers = useEmployers();
  const rules = useRules();
  const since = addDays(today, -CONTEXT_DAYS);
  const transactions = useQuery({
    queryKey: [...aiKeys.all, 'transactions', since],
    queryFn: () => fetchTransactionsSince(since),
  });
  const pendingSends = usePendingSends();

  const [input, setInput] = useState('');
  // 相談（チャット）か、入力（写真・ファイルから記録を読み取る）か
  const [mode, setMode] = useState<'chat' | 'import'>('chat');
  // AI入力の途中で閉じていたら、入力を開いて続きを出す
  useEffect(() => {
    loadImportJob().then((job) => job && setMode('import'));
  }, []);
  useRestoreConversation(conversationId, conversations.data);
  const sender = useChatSender({ conversationId, restoreInput: setInput, onSent: () => usage.refetch() });

  const stored: ChatItem[] = conversationId ? (conversation.data?.messages ?? []) : [];
  const items = sender.pending ? [...stored, sender.pending] : stored;

  // 右上の小さな円のゲージ（この会話で使ったトークン）。連携していて、モデルが分かるときだけ
  const currentModel = status.data?.models.find((m) => m.id === status.data?.model);
  const headerRight = () => (
    <View style={styles.headerRight}>
      {status.data?.hasKey && currentModel && (
        <TokenGauge
          modelLabel={currentModel.label}
          used={conversationId ? (conversation.data?.conversation.last_total_tokens ?? 0) : 0}
          limit={currentModel.inputTokenLimit}
          todayCount={usage.data?.count ?? 0}
          todayTokens={usage.data?.tokens ?? 0}
        />
      )}
      <IconButton icon="history" accessibilityLabel="会話の履歴" onPress={() => router.push('/ai-history')} />
      <IconButton
        icon="square-edit-outline"
        accessibilityLabel="新しいチャット"
        disabled={!conversationId || sender.sending}
        onPress={() => {
          sender.clearError();
          forgetLastConversation();
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
  if (sources.some((q) => !q.data)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Tabs.Screen options={{ headerRight }} />
        <QueriesState queries={sources} />
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
  const context = () => ({
    aliases,
    system: buildChatSystem(source, aliases, home.figures),
    model: status.data?.model,
  });

  const send = () => {
    const text = input.trim();
    if (text === '' || sender.sending) return;
    setInput('');
    sender.send(text, stored, context, maskText(text, aliases));
  };

  // 画面を閉じたあとも送り直しを待っている、この会話の質問（バックグラウンドで送り直している）
  // （この画面で送っている間は、その質問は送り直しの表示に出ている）
  const waiting = sender.sending
    ? []
    : (pendingSends.data ?? []).filter((p) => p.conversationId === (conversationId ?? null));

  // ピン留めしていない会話は消えることを、開いている会話でも分かるようにする
  const header =
    conversation.data?.conversation.pinned && conversationId
      ? 'ピン留め中の会話'
      : conversationId && conversation.data
        ? `この会話はあと${daysUntilDeletion(conversation.data.conversation.updated_at, new Date())}日で消えます（履歴でピン留めすると残ります）`
        : `会話は保存され、ピン留めしなければ${RETENTION_DAYS}日で消えます`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tabs.Screen options={{ headerRight }} />
      {conversations.data && <AutoTitler conversations={conversations.data} aliases={aliases} />}
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => setMode(v as 'chat' | 'import')}
        density="small"
        style={styles.mode}
        buttons={[
          { value: 'chat', label: '相談', icon: 'chat-outline' },
          { value: 'import', label: '入力', icon: 'text-recognition' },
        ]}
      />
      {mode === 'import' ? (
        <AiImport
          today={today}
          accounts={accounts.data ?? []}
          categories={categories.data!}
          aliases={aliases}
          balances={balanceMap}
        />
      ) : (
        <>
          <View style={[styles.titleBar, { borderBottomColor: theme.colors.outlineVariant }]}>
            <Text variant="titleSmall" numberOfLines={1} style={styles.title}>
              {(conversationId && conversation.data?.conversation.title) || '新しいチャット'}
            </Text>
          </View>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.container}
            keyboardVerticalOffset={insets.top + 64 + TITLE_BAR_HEIGHT + MODE_BAR_HEIGHT}
          >
            <ChatMessages
              items={items}
              header={header}
              thinking={sender.sending && !sender.retry}
              retry={sender.retry}
              onCancelRetry={sender.cancelRetry}
              waiting={waiting}
              onCancelWaiting={async (p) => {
                await takePending(p.id);
                setInput(p.question.shown);
                queryClient.invalidateQueries({ queryKey: aiKeys.pending() });
              }}
              error={sender.error}
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
                disabled={input.trim() === '' || sender.sending}
                onPress={send}
              />
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mode: { marginHorizontal: SPACING.screen, marginTop: 8 },
  titleBar: {
    height: TITLE_BAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: SPACING.screen,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  input: { flex: 1, maxHeight: 120 },
});
