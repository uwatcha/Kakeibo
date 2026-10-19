import { Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useAiStatus, useDeleteAiKey, useSaveAiKey, useSetAiModel } from '@/features/ai/hooks';
import { SPACING } from '@/theme';

const API_KEY_PAGE = 'https://aistudio.google.com/apikey';

/** AI 相談（Gemini）の API キーとモデル。キーはサーバー（Supabase）に保存し、この端末には残さない */
export default function AiSettingsScreen() {
  const theme = useTheme();
  const status = useAiStatus();
  const save = useSaveAiKey();
  const remove = useDeleteAiKey();
  const setModel = useSetAiModel();
  const [key, setKey] = useState('');

  if (!status.data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'AI 相談の設定' }} />
        <QueryState isLoading={status.isLoading} error={status.error} onRetry={status.refetch} />
      </View>
    );
  }

  const { hasKey, model, models } = status.data;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'AI 相談の設定' }} />
      {hasKey ? (
        <>
          <SectionCard>
            <ListRow title="Gemini" subtitle="連携済み" icon="check-circle-outline" />
          </SectionCard>
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
          <Button
            mode="outlined"
            icon="link-off"
            textColor={theme.colors.error}
            loading={remove.isPending}
            disabled={remove.isPending}
            onPress={() => remove.mutate()}
          >
            連携を解除
          </Button>
        </>
      ) : (
        <SectionCard style={styles.form}>
          <TextInput
            mode="outlined"
            label="Gemini の API キー"
            value={key}
            onChangeText={setKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <HelperText type="error" visible={save.isError}>
            {save.error?.message}
          </HelperText>
          <Button
            mode="contained"
            loading={save.isPending}
            disabled={key.trim() === '' || save.isPending}
            onPress={() => save.mutate(key.trim(), { onSuccess: () => setKey('') })}
          >
            連携する
          </Button>
          <Button mode="text" icon="open-in-new" onPress={() => Linking.openURL(API_KEY_PAGE)}>
            API キーを作る（Google AI Studio）
          </Button>
        </SectionCard>
      )}
      {(status.error || remove.isError) && (
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
  form: { padding: SPACING.row, gap: 4 },
});
