import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button, IconButton, Menu, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QueriesState } from '@/components/QueryState';
import { useAccountBalances, useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { buildAliases, maskText } from '@/features/ai/anonymize';
import { buildChatSystem } from '@/features/ai/chatContext';
import { AiImport } from '@/features/ai/components/AiImport';
import { AutoTitler } from '@/features/ai/components/AutoTitler';
import { dataUriToJpegBase64, toJpegBase64 } from '@/features/ai/image';
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
 * AI のタブ。上の切り替えで「相談」（家計の相談に乗る AI（Gemini・Claude）とのチャット）と「入力」（AI入力）。
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
  // 質問に添える画像（横幅 1024px の JPEG の base64。2026-11-24 ユーザーの要望）
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  // スマホの画像のボタンのメニュー（選ぶ・撮る・貼る）
  const [imageMenu, setImageMenu] = useState(false);

  /** 画像を足す（枚数の上限はない。2026-11-24 ユーザーの指定） */
  const appendImages = (added: string[]) => setImages((list) => [...list, ...added]);

  // Web 版: コピーした画像を Cmd+V（Ctrl+V）で貼れる（相談を開いているときだけ。文の貼り付けはそのまま。2026-11-24）
  useEffect(() => {
    if (Platform.OS !== 'web' || mode !== 'chat') return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is globalThis.File => !!f);
      if (files.length === 0) return;
      e.preventDefault();
      setImageError(null);
      Promise.all(
        files.map(async (file) => {
          const url = URL.createObjectURL(file);
          try {
            const width = await new Promise<number>((resolve, reject) => {
              const img = new window.Image();
              img.onload = () => resolve(img.naturalWidth);
              img.onerror = reject;
              img.src = url;
            });
            return await toJpegBase64(url, width);
          } finally {
            URL.revokeObjectURL(url);
          }
        }),
      )
        .then(appendImages)
        .catch(() => setImageError('貼り付けた画像を読み込めませんでした'));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [mode]);
  // AI入力の途中で閉じていたら、入力を開いて続きを出す
  useEffect(() => {
    loadImportJob().then((job) => job && setMode('import'));
  }, []);
  useRestoreConversation(conversationId, conversations.data);
  const sender = useChatSender({
    conversationId,
    restoreInput: (text, restored) => {
      setInput(text);
      setImages(restored ?? []);
    },
    onSent: () => usage.refetch(),
  });

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
  // 相談・入力の切り替えは、読み込みの途中でも出しておく（2026-11-22 改善要望）
  const modeBar = (
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
  );
  if (sources.some((q) => !q.data)) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Tabs.Screen options={{ headerRight }} />
        {modeBar}
        <QueriesState queries={sources} />
      </View>
    );
  }

  if (!status.data!.hasKey) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Tabs.Screen options={{ headerRight }} />
        {modeBar}
        <View style={[styles.container, styles.center]}>
          <Button mode="contained" icon="link" onPress={() => router.push('/ai-settings')}>
            AI と連携する
          </Button>
        </View>
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
    if ((text === '' && images.length === 0) || sender.sending) return;
    setInput('');
    setImages([]);
    setImageError(null);
    sender.send(text, stored, context, maskText(text, aliases), images);
  };

  /** スマホ: コピーした画像を貼る */
  const pasteImage = async () => {
    setImageError(null);
    try {
      const image = await Clipboard.getImageAsync({ format: 'jpeg' });
      if (!image) {
        setImageError('コピーした画像がありません');
        return;
      }
      appendImages([await dataUriToJpegBase64(image.data, image.size.width)]);
    } catch {
      setImageError('コピーした画像を読み込めませんでした');
    }
  };

  /** 画像を選ぶ・撮る（Web 版は選ぶだけ） */
  const addImages = async (camera: boolean) => {
    setImageError(null);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setImageError('カメラを使う許可がありません');
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 0,
            orderedSelection: true,
          });
      if (result.canceled || !result.assets?.length) return;
      const picked = await Promise.all(result.assets.map((a) => toJpegBase64(a.uri, a.width)));
      appendImages(picked);
    } catch {
      setImageError('画像を読み込めませんでした');
    }
  };

  // Web 版は Cmd+Enter（Windows などは Ctrl+Enter）でも送る。日本語の変換中の Enter は送らない
  const onKeyPress = (e: { nativeEvent: unknown; preventDefault: () => void }) => {
    if (Platform.OS !== 'web') return;
    const key = e.nativeEvent as KeyboardEvent;
    if (key.key !== 'Enter' || !(key.metaKey || key.ctrlKey) || key.isComposing || key.keyCode === 229) return;
    e.preventDefault();
    send();
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
      {modeBar}
      <View style={styles.container}>
        {/* 相談・入力は両方とも置いたままにして、使っていないほうを隠す（切り替えても入力の途中・スクロールの位置が
            消えないように。2026-11-24 改善要望。外すと作り直しになる） */}
        <View
          style={[styles.container, mode !== 'import' && styles.hidden]}
          pointerEvents={mode === 'import' ? 'auto' : 'none'}
          aria-hidden={mode !== 'import'}
        >
          <AiImport
            today={today}
            accounts={accounts.data ?? []}
            categories={categories.data!}
            aliases={aliases}
            balances={balanceMap}
          />
        </View>
        <View
          style={[styles.container, mode !== 'chat' && styles.hidden]}
          pointerEvents={mode === 'chat' ? 'auto' : 'none'}
          aria-hidden={mode !== 'chat'}
        >
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
            {(images.length > 0 || imageError) && (
              <View style={{ backgroundColor: theme.colors.surface }}>
                {images.length > 0 && (
                  <ScrollView horizontal style={styles.attachBar} contentContainerStyle={styles.attachments}>
                    {images.map((data, i) => (
                      <View key={i}>
                        <Image source={{ uri: `data:image/jpeg;base64,${data}` }} style={styles.attachment} />
                        <IconButton
                          icon="close"
                          size={14}
                          mode="contained"
                          accessibilityLabel={`画像${i + 1}を外す`}
                          onPress={() => setImages((list) => list.filter((_, j) => j !== i))}
                          style={styles.removeImage}
                        />
                      </View>
                    ))}
                  </ScrollView>
                )}
                {imageError && (
                  <Text variant="bodySmall" style={[styles.imageError, { color: theme.colors.error }]}>
                    {imageError}
                  </Text>
                )}
              </View>
            )}
            <View style={[styles.inputBar, { backgroundColor: theme.colors.surface }]}>
              {Platform.OS === 'web' ? (
                // Web 版は選ぶだけ（コピーした画像は Cmd+V で貼る。PC では写真を撮らない: 2026-10-28 ユーザーの指示）
                <IconButton
                  icon="image-plus"
                  accessibilityLabel="画像を添える"
                  disabled={sender.sending}
                  onPress={() => addImages(false)}
                  style={styles.attachButton}
                />
              ) : (
                <Menu
                  visible={imageMenu}
                  onDismiss={() => setImageMenu(false)}
                  anchor={
                    <IconButton
                      icon="image-plus"
                      accessibilityLabel="画像を添える"
                      disabled={sender.sending}
                      onPress={() => setImageMenu(true)}
                      style={styles.attachButton}
                    />
                  }
                >
                  <Menu.Item
                    leadingIcon="image-multiple"
                    title="画像を選ぶ"
                    onPress={() => {
                      setImageMenu(false);
                      addImages(false);
                    }}
                  />
                  <Menu.Item
                    leadingIcon="camera"
                    title="写真を撮る"
                    onPress={() => {
                      setImageMenu(false);
                      addImages(true);
                    }}
                  />
                  <Menu.Item
                    leadingIcon="content-paste"
                    title="コピーした画像を貼る"
                    onPress={() => {
                      setImageMenu(false);
                      pasteImage();
                    }}
                  />
                </Menu>
              )}
              <TextInput
                mode="outlined"
                placeholder="家計について聞く"
                value={input}
                onChangeText={setInput}
                onKeyPress={onKeyPress}
                multiline
                dense
                style={styles.input}
              />
              <IconButton
                icon="send"
                mode="contained"
                accessibilityLabel="送る"
                disabled={(input.trim() === '' && images.length === 0) || sender.sending}
                onPress={send}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 隠しているほう（置いたまま、見えない・押せないようにする）
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: -1 },
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
  attachButton: { margin: 0 },
  // 横にスクロールする欄は高さを中身に合わせて固定する（DESIGN.md）
  attachBar: { flexGrow: 0, flexShrink: 0 },
  attachments: { paddingHorizontal: 12, paddingTop: 8, gap: 8, alignItems: 'center' },
  attachment: { width: 64, height: 64, borderRadius: 8 },
  removeImage: { position: 'absolute', top: -6, right: -6, margin: 0 },
  imageError: { paddingHorizontal: 16, paddingTop: 4 },
});
