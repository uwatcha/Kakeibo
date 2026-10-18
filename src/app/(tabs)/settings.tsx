import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, List, Snackbar, useTheme } from 'react-native-paper';

import { useAuth } from '@/features/auth/AuthProvider';
import { exportBackupJson, exportTransactionsCsv } from '@/features/export/exportData';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [exporting, setExporting] = useState<'csv' | 'backup' | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const runExport = async (kind: 'csv' | 'backup') => {
    setExporting(kind);
    try {
      await (kind === 'csv' ? exportTransactionsCsv() : exportBackupJson());
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(null);
    }
  };

  const exportItem = (kind: 'csv' | 'backup', title: string, icon: string) => (
    <List.Item
      title={title}
      left={(props) => <List.Icon {...props} icon={icon} />}
      right={(props) => (exporting === kind ? <ActivityIndicator {...props} /> : null)}
      disabled={exporting !== null}
      onPress={() => runExport(kind)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        <List.Item
          title="口座の管理"
          left={(props) => <List.Icon {...props} icon="wallet" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/accounts')}
        />
        <List.Item
          title="カテゴリの管理"
          left={(props) => <List.Icon {...props} icon="shape" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/categories')}
        />
        <List.Item
          title="働き先と給料日"
          left={(props) => <List.Icon {...props} icon="briefcase" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/employers')}
        />
        <List.Item
          title="定期支払い"
          left={(props) => <List.Icon {...props} icon="autorenew" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/recurring')}
        />
        <List.Section title="データ">
          {exportItem('csv', '記録を CSV で書き出す', 'file-delimited')}
          {exportItem('backup', 'バックアップを書き出す', 'database-export')}
        </List.Section>
        <List.Item
          title="ログイン中"
          description={session?.user.email}
          left={(props) => <List.Icon {...props} icon="account" />}
        />
        <Button mode="outlined" style={styles.logout} onPress={() => supabase.auth.signOut()}>
          ログアウト
        </Button>
      </ScrollView>
      <Snackbar visible={exportFailed} onDismiss={() => setExportFailed(false)}>
        書き出せませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logout: { margin: 16 },
});
