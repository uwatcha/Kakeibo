import { useState } from 'react';
import { IconButton, useTheme } from 'react-native-paper';

import { useAccountBalances } from '../hooks';
import { AvailableAccountsSheet } from './AvailableAccountsSheet';

/** 上のバーに置く、実質残高に含める口座を選ぶパネルのボタン。設定はどの画面の計算にも使われる */
export function AvailableAccountsButton() {
  const theme = useTheme();
  const balances = useAccountBalances();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon="tune-variant"
        iconColor={theme.colors.primary}
        accessibilityLabel="実質残高に含める口座"
        disabled={!balances.data}
        onPress={() => setOpen(true)}
      />
      {balances.data && (
        <AvailableAccountsSheet visible={open} onDismiss={() => setOpen(false)} accounts={balances.data} />
      )}
    </>
  );
}
