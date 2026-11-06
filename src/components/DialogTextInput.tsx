import type { ComponentProps } from 'react';
import { TextInput } from 'react-native-paper';

/**
 * ダイアログ（Portal の中）の文字の入力欄。Portal の中で value を渡して入力のたびに入れ直すと、日本語の変換中の文字が
 * 上書きされて、すぐ確定してしまう（2026-11-06 バグ報告:「相手を追加」で全角の文字が入れられない）。
 * value は渡さず、初めの値（initialValue）だけ渡して、入力は onChangeText で受け取る。空にし直すときは key を変えて作り直す
 */
export function DialogTextInput({
  initialValue,
  ...props
}: Omit<ComponentProps<typeof TextInput>, 'value' | 'defaultValue'> & { initialValue?: string }) {
  return <TextInput {...props} defaultValue={initialValue} />;
}
