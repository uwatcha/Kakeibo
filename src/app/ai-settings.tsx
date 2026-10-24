import { Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import type { AiProvider } from '@/features/ai/api';
import { useAiStatus, useDeleteAiKey, useSaveAiKey, useSetAiModel } from '@/features/ai/hooks';
import { SPACING } from '@/theme';

const PROVIDERS: Record<AiProvider, { name: string; keyPage: string; keyPageName: string }> = {
  gemini: { name: 'Gemini', keyPage: 'https://aistudio.google.com/apikey', keyPageName: 'Google AI Studio' },
  claude: { name: 'Claude', keyPage: 'https://console.anthropic.com/settings/keys', keyPageName: 'Anthropic Console' },
};

/** 期限の何日前から赤で出すか（通知も同じ日に出す。claudeKeyReminder.ts） */
const WARN_DAYS = 3;

function expiryLabel(expiresAt: string | null): { text: string; warn: boolean } | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  const left = end.getTime() - Date.now();
  if (left <= 0) return { text: '期限切れ', warn: true };
  return { text: `${end.getMonth() + 1}/${end.getDate()} まで`, warn: left <= WARN_DAYS * 86_400_000 };
}

/** 1社分のキー: 連携済みなら状態と解除、まだならキーの入力。Claude は期限があるので、連携済みでも入れ直せる */
function ProviderSection({
  provider,
  connected,
  expiresAt,
}: {
  provider: AiProvider;
  connected: boolean;
  expiresAt: string | null;
}) {
  const theme = useTheme();
  const save = useSaveAiKey();
  const remove = useDeleteAiKey();
  const [key, setKey] = useState('');
  const { name, keyPage, keyPageName } = PROVIDERS[provider];
  const expiry = expiryLabel(expiresAt);
  const showForm = !connected || provider === 'claude';

  return (
    <SectionCard title={name}>
      {connected && (
        <ListRow
          title="連携済み"
          subtitle={
            expiry ? (
              <Text
                variant="bodySmall"
                style={{ color: expiry.warn ? theme.colors.error : theme.colors.onSurfaceVariant }}
              >
                {expiry.text}
              </Text>
            ) : undefined
          }
          icon={expiry?.warn ? 'alert-circle-outline' : 'check-circle-outline'}
          iconColor={expiry?.warn ? theme.colors.error : undefined}
          right={
            <Button
              compact
              textColor={theme.colors.error}
              loading={remove.isPending}
              disabled={remove.isPending}
              onPress={() => remove.mutate(provider)}
            >
              解除
            </Button>
          }
        />
      )}
      {showForm && (
        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label={connected ? '新しい API キー' : `${name} の API キー`}
            value={key}
            onChangeText={setKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <HelperText type="error" visible={save.isError || remove.isError}>
            {save.error?.message ?? (remove.isError ? '通信できませんでした' : '')}
          </HelperText>
          <Button
            mode="contained"
            loading={save.isPending}
            disabled={key.trim() === '' || save.isPending}
            onPress={() => save.mutate({ provider, key: key.trim() }, { onSuccess: () => setKey('') })}
          >
            {connected ? '入れ直す' : '連携する'}
          </Button>
          <Button mode="text" icon="open-in-new" onPress={() => Linking.openURL(keyPage)}>
            {keyPageName} を開く
          </Button>
        </View>
      )}
    </SectionCard>
  );
}

/** AI 相談の API キー（Gemini・Claude）とモデル。キーはサーバー（Supabase）に保存し、この端末には残さない */
export default function AiSettingsScreen() {
  const theme = useTheme();
  const status = useAiStatus();
  const setModel = useSetAiModel();

  if (!status.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'AI 相談の設定' }} />
        <QueryState isLoading={status.isLoading} error={status.error} onRetry={status.refetch} />
      </View>
    );
  }

  const { hasKey, gemini, claude, claudeExpiresAt, model, models } = status.data;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'AI 相談の設定' }} />
      {hasKey && (
        <SectionCard title="モデル" style={styles.models}>
          <View style={styles.inner}>
            <ChipGroup
              options={models.map((m) => ({ value: m.id, label: m.label }))}
              value={setModel.isPending ? (setModel.variables ?? model) : model}
              onChange={(id) => id && setModel.mutate(id)}
              rows={2}
            />
            <HelperText type="error" visible={setModel.isError}>
              変更できませんでした
            </HelperText>
          </View>
        </SectionCard>
      )}
      <ProviderSection provider="gemini" connected={gemini} expiresAt={null} />
      <ProviderSection provider="claude" connected={claude} expiresAt={claudeExpiresAt} />
      {status.error && (
        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
          通信できませんでした
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap },
  models: { paddingBottom: 8 },
  inner: { paddingHorizontal: SPACING.row },
  form: { padding: SPACING.row, paddingTop: 4, gap: 4 },
});
