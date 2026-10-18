import { StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';

import { type ChipOption, ChipGroup } from '@/components/ChipGroup';
import { ACCOUNT_KIND_INFO, type AccountKind } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';

type Props = {
  label: string;
  kinds: readonly AccountKind[];
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
};

export function AccountPicker({ label, kinds, accounts, value, onChange, error }: Props) {
  // 非表示の口座は出さない。ただし編集中の記録が使っている口座は残す
  const options: ChipOption[] = accounts
    .filter((a) => kinds.includes(a.kind) && (!a.is_archived || a.id === value))
    .map((a) => ({ value: a.id, label: a.name, icon: ACCOUNT_KIND_INFO[a.kind].icon }));

  return (
    <View style={styles.container}>
      <Text variant="labelLarge">{label}</Text>
      {options.length === 0 ? (
        <HelperText type="info">
          選べる口座がありません（{kinds.map((k) => ACCOUNT_KIND_INFO[k].label).join('・')}）。設定 →
          口座の管理から追加してください
        </HelperText>
      ) : (
        <ChipGroup options={options} value={value} onChange={onChange} />
      )}
      {!!error && <HelperText type="error">{error}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
});
