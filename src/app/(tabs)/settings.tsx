import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { exportBackupJson, exportTransactionsCsv } from '@/features/export/exportData';
import { supabase } from '@/lib/supabase';
import { SPACING } from '@/theme';

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

  const chevron = <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />;

  const navItem = (title: string, icon: string, href: Href) => (
    <ListRow title={title} icon={icon} right={chevron} onPress={() => router.push(href)} />
  );

  const exportItem = (kind: 'csv' | 'backup', title: string, icon: string) => (
    <ListRow
      title={title}
      icon={icon}
      right={exporting === kind ? <ActivityIndicator size={20} /> : null}
      disabled={exporting !== null}
      onPress={() => runExport(kind)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard>
          {navItem('口座の管理', 'wallet', '/accounts')}
          {navItem('カテゴリの管理', 'shape', '/categories')}
          {navItem('働き先と給料日', 'briefcase', '/employers')}
          {navItem('定期支払い', 'autorenew', '/recurring')}
        </SectionCard>
        <SectionCard title="データ">
          {exportItem('csv', '記録を CSV で書き出す', 'file-delimited')}
          {exportItem('backup', 'バックアップを書き出す', 'database-export')}
        </SectionCard>
        <SectionCard>
          <ListRow title="ログイン中" subtitle={session?.user.email} icon="account" />
        </SectionCard>
        <Button mode="outlined" onPress={() => supabase.auth.signOut()}>
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
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap },
});
