import { useState } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
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

/** 内容の欄。入力中は、入力した文字を含む過去の内容を候補に出す */
export function PayeeField({ control, history, onCommit }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Controller
      control={control}
      name="payee"
      render={({ field: { onChange, onBlur, value } }) => (
        <View>
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
          {focused && (
            <View style={styles.suggestions}>
              {suggestPayees(history, value).map((payee) => (
                <Chip
                  key={payee}
                  compact
                  icon="history"
                  onPress={() => {
                    onChange(payee);
                    onCommit(payee);
                  }}
                >
                  {payee}
                </Chip>
              ))}
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
