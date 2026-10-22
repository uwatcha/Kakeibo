import { Share, StyleSheet } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';

import { EMAIL_IMPORT_ENDPOINT } from '../api';
import { buildAppsScript } from '../appsScript';

/** 作った合言葉と、合言葉入りの Apps Script のコードの共有（この画面を閉じたら、合言葉は二度と出せない）。Portal の中に置く */
export function TokenDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  return (
    <Dialog visible={token !== null} onDismiss={onClose}>
      <Dialog.Title>合言葉</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" selectable style={styles.token}>
          {token}
        </Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onClose}>閉じる</Button>
        <Button
          icon="share-variant"
          onPress={() => token && Share.share({ message: buildAppsScript(EMAIL_IMPORT_ENDPOINT, token) })}
        >
          Apps Script のコードを共有
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({ token: { fontFamily: 'monospace' } });
