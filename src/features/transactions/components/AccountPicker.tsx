import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { ACCOUNT_KIND_INFO, type AccountKind, PERSON_KINDS } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useCreateAccount } from '@/features/accounts/hooks';

import { pickerAccounts } from '../pickerAccounts';

type Props = {
  label: string;
  kinds: readonly AccountKind[];
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  /** 口座ごとの今日までの残高。あれば残高 0 円の貸し借りの相手を隠す */
  balances?: ReadonlyMap<string, number>;
};

export function AccountPicker({ label, kinds, accounts, value, onChange, error, balances }: Props) {
  const [showAll, setShowAll] = useState(false);
  const { shown, hiddenCount } = pickerAccounts(accounts, kinds, value, balances, showAll);
  // 選ぶのが貸し借りの相手だけなら、その場で相手を追加できる
  const personKind = kinds.length > 0 && kinds.every((k) => PERSON_KINDS.includes(k)) ? kinds[0] : null;

  const create = useCreateAccount();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const addPerson = async () => {
    if (!personKind || name.trim() === '') return;
    try {
      const id = await create.mutateAsync({ name: name.trim(), kind: personKind, opening_balance: 0 });
      onChange(id);
      setAdding(false);
      setName('');
    } catch {
      // ダイアログの中で知らせる（create.isError）
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="labelLarge">{label}</Text>
      {shown.length === 0 && hiddenCount === 0 && !personKind ? (
        <HelperText type="info">選べる口座がありません</HelperText>
      ) : (
        <ChipGroup
          options={shown.map((a) => ({ value: a.id, label: a.name, icon: ACCOUNT_KIND_INFO[a.kind].icon }))}
          value={value}
          onChange={onChange}
          extra={
            <>
              {hiddenCount > 0 && (
                <Chip icon="dots-horizontal" mode="outlined" onPress={() => setShowAll(true)}>
                  すべて表示（{hiddenCount}）
                </Chip>
              )}
              {personKind && (
                <Chip icon="plus" mode="outlined" onPress={() => setAdding(true)}>
                  相手を追加
                </Chip>
              )}
            </>
          }
        />
      )}
      {!!error && <HelperText type="error">{error}</HelperText>}

      <Portal>
        <Dialog visible={adding} onDismiss={() => setAdding(false)}>
          <Dialog.Title>{personKind ? ACCOUNT_KIND_INFO[personKind].label : ''}を追加</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="名前" value={name} onChangeText={setName} autoFocus />
            <HelperText type="error" visible={create.isError}>
              追加できませんでした。通信状態を確認してください
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAdding(false)}>キャンセル</Button>
            <Button onPress={addPerson} loading={create.isPending} disabled={name.trim() === '' || create.isPending}>
              追加
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
});
