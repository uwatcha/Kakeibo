import { useState } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, TextInput } from 'react-native-paper';

import { suggestPayees } from '../payeeSuggest';
import type { FormValues } from './values';

type Props = {
  control: Control<FormValues>;
  /** 過去の内容（よく使う順の候補を作る） */
  history: Parameters<typeof suggestPayees>[0];
  /** 内容が決まったとき（欄を離れた・候補を押した）。カテゴリを予測する */
  onCommit: (payee: string) => void;
};

/**
 * 内容の欄。入力中は、入力した文字を含む過去の内容を候補に出す。
 * 候補は欄の上に横1行で出す（下に出すとキーボードに隠れる。2026-10-28 改善要望）
 */
export function PayeeField({ control, history, onCommit }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Controller
      control={control}
      name="payee"
      render={({ field: { onChange, onBlur, value } }) => (
        <View>
          {focused && (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestions}
            >
              {suggestPayees(history, value).map((payee) => (
                <Chip
                  key={payee}
                  compact
                  icon="history"
                  onPress={() => {
                    onChange(payee);
                    // キーボードは閉じない（閉じると欄を離れたときの処理が、押す前の文字でカテゴリを予測し直してしまう）
                    onCommit(payee);
                  }}
                >
                  {payee}
                </Chip>
              ))}
            </ScrollView>
          )}
          <TextInput
            mode="outlined"
            label="内容（任意）"
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
              onCommit(value);
            }}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  suggestions: { gap: 6, paddingBottom: 6 },
});
