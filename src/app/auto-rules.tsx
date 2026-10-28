import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Button, Snackbar, TextInput, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { useEmailImportSettings, useSaveSummaryRules } from '@/features/emailImport/hooks';
import { SPACING } from '@/theme';

import { DEFAULT_SUMMARY_RULES } from '../../supabase/functions/_shared/emailRules';

/** 書いている欄（読み込めたら、保存済みのルールで始める） */
function RulesEditor({ initial }: { initial: string }) {
  const theme = useTheme();
  const save = useSaveSummaryRules();
  const [draft, setDraft] = useState(initial);
  const submit = (rules: string | null) => save.mutate(rules, { onSuccess: () => router.back() });
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              onPress={() => submit(draft.trim() === DEFAULT_SUMMARY_RULES ? null : draft.trim())}
              disabled={!draft.trim() || save.isPending}
              loading={save.isPending}
            >
              保存
            </Button>
          ),
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <TextInput
          mode="outlined"
          multiline
          value={draft}
          onChangeText={setDraft}
          style={styles.input}
          contentStyle={styles.inputContent}
        />
        <Button onPress={() => submit(null)} disabled={save.isPending} style={styles.reset}>
          初期に戻す
        </Button>
      </KeyboardAwareScrollView>
      <Snackbar visible={save.isError} onDismiss={save.reset}>
        保存できませんでした。通信状態を確認してください
      </Snackbar>
    </View>
  );
}

/**
 * 自動入力のルール（旧・内容の要約ルール）を書く画面（2026-10-28 ユーザーの要望: 小さなウィンドウでなく画面いっぱいに）。
 * メールからの記録・AI入力・写真からの記録の AI に渡す。設定とメールからの記録の画面から開く
 */
export default function AutoRulesScreen() {
  const theme = useTheme();
  const settings = useEmailImportSettings();
  if (!settings.isSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <QueryState isLoading={settings.isLoading} error={settings.error} onRetry={settings.refetch} />
      </View>
    );
  }
  return <RulesEditor initial={settings.data?.summary_rules ?? DEFAULT_SUMMARY_RULES} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: 8, flexGrow: 1 },
  input: { flexGrow: 1, minHeight: 320 },
  inputContent: { paddingTop: 12 },
  reset: { alignSelf: 'flex-start' },
});
