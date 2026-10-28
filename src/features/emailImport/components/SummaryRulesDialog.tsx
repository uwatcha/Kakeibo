import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, TextInput } from 'react-native-paper';

import { DEFAULT_SUMMARY_RULES } from '../../../../supabase/functions/_shared/emailRules';

type Props = {
  /** 開いたときのルール */
  initial: string;
  onDismiss: () => void;
  /** null は初期のルールに戻す */
  onSave: (rules: string | null) => void;
};

/**
 * 自動入力のルール（旧・内容の要約ルール）を書き換える。メールからの記録・AI入力・写真からの記録の AI に渡す
 * （2026-10-28 改善要望）。開くたびに作り直す（key を付けて Portal の中に置く）
 */
export function SummaryRulesDialog({ initial, onDismiss, onSave }: Props) {
  const [draft, setDraft] = useState(initial);
  return (
    <Dialog visible onDismiss={onDismiss}>
      <Dialog.Title>自動入力のルール</Dialog.Title>
      <Dialog.ScrollArea style={styles.scrollArea}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <TextInput mode="outlined" multiline value={draft} onChangeText={setDraft} />
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={() => onSave(null)}>初期に戻す</Button>
        <Button
          disabled={!draft.trim()}
          onPress={() => onSave(draft.trim() === DEFAULT_SUMMARY_RULES ? null : draft.trim())}
        >
          保存
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({ scrollArea: { maxHeight: 420, paddingHorizontal: 24 } });
