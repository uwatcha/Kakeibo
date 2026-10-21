import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  HelperText,
  Portal,
  Snackbar,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { exportBackupJson, exportTransactionsCsv } from '@/features/export/exportData';
import { useDailyLiving, useSaveMonthlyLivingCost } from '@/features/settings/hooks';
import { toTokyoDateString } from '@/lib/date';
import { formatYen, parseNonNegativeYen } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { SPACING } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const [exporting, setExporting] = useState<'csv' | 'backup' | null>(null);
  const [exportFailed, setExportFailed] = useState(false);
  // 生活費（給料日までに使える額の取り置きの計算に使う）。空なら記録から自動で見積もる
  const living = useDailyLiving(toTokyoDateString());
  const saveLiving = useSaveMonthlyLivingCost();
  // 1日と1か月の2つの欄。片方を入れると、もう片方を30日で換算して入れる（保存は1か月分）
  const [livingForm, setLivingForm] = useState<{ day: string; month: string } | null>(null);
  const convert = (text: string, factor: number, divide: boolean) => {
    const value = parseNonNegativeYen(text);
    return value === null ? '' : String(divide ? Math.round(value / factor) : value * factor);
  };
  const livingSubtitle =
    living.manual !== null
      ? `1日 ${formatYen(Math.round(living.manual / 30))}・月 ${formatYen(living.manual)}（設定した額）`
      : `自動: 1日 ${formatYen(living.estimated ?? 0)}・月 ${formatYen((living.estimated ?? 0) * 30)}`;
  const livingMonthly = livingForm === null ? null : parseNonNegativeYen(livingForm.month);
  const livingInvalid =
    livingForm !== null &&
    ((livingForm.day.trim() !== '' && parseNonNegativeYen(livingForm.day) === null) ||
      (livingForm.month.trim() !== '' && livingMonthly === null));

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
          {navItem('振替の優先度', 'swap-vertical', '/transfer-order')}
          <ListRow
            title="生活費"
            subtitle={livingSubtitle}
            icon="cart-outline"
            right={chevron}
            onPress={() =>
              setLivingForm(
                living.manual !== null
                  ? { day: String(Math.round(living.manual / 30)), month: String(living.manual) }
                  : { day: '', month: '' },
              )
            }
          />
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
      <Portal>
        <Dialog visible={livingForm !== null} onDismiss={() => setLivingForm(null)}>
          <Dialog.Title>生活費</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <TextInput
              mode="outlined"
              label="1日"
              keyboardType="number-pad"
              value={livingForm?.day ?? ''}
              onChangeText={(day) => setLivingForm({ day, month: convert(day, 30, false) })}
              right={<TextInput.Affix text="円" />}
            />
            <TextInput
              mode="outlined"
              label="1か月"
              keyboardType="number-pad"
              value={livingForm?.month ?? ''}
              onChangeText={(month) => setLivingForm({ day: convert(month, 30, true), month })}
              right={<TextInput.Affix text="円" />}
            />
            <HelperText type="error" visible={livingInvalid}>
              0以上の整数（円）で入力してください
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                saveLiving.mutate(null);
                setLivingForm(null);
              }}
            >
              自動に戻す
            </Button>
            <Button
              disabled={livingMonthly === null || livingInvalid}
              onPress={() => {
                saveLiving.mutate(livingMonthly);
                setLivingForm(null);
              }}
            >
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={saveLiving.isError} onDismiss={saveLiving.reset}>
        保存できませんでした
      </Snackbar>
      <Snackbar visible={exportFailed} onDismiss={() => setExportFailed(false)}>
        書き出せませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { gap: 8 },
  container: { flex: 1 },
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap },
});
