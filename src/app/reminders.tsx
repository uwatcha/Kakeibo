import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, useTheme } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { SectionCard } from '@/components/SectionCard';
import {
  HOURS,
  INTERVALS,
  loadReminderSettings,
  REMINDERS,
  type ReminderKind,
  type ReminderSettings,
  saveReminderSettings,
} from '@/features/reminders/reminders';
import { toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

const intervalOptions = INTERVALS.map((i) => ({ value: String(i.days), label: i.label }));
const hourOptions = HOURS.map((h) => ({ value: String(h), label: `${h}時` }));

/** 設定 > 確認の通知。項目ごとに通知する間隔と、全部の項目で共通の時刻を選ぶ（設定はこの端末だけ） */
export default function RemindersScreen() {
  const theme = useTheme();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadReminderSettings().then(setSettings);
  }, []);

  const save = (next: ReminderSettings) => {
    setSettings(next);
    saveReminderSettings(next).catch(() => setFailed(true));
  };
  const setInterval = (kind: ReminderKind, days: number) => {
    if (!settings) return;
    // 間隔を変えた日から数え直す
    save({ ...settings, items: { ...settings.items, [kind]: { days, from: toTokyoDateString() } } });
  };

  if (!settings) return <View style={[styles.container, { backgroundColor: theme.colors.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {REMINDERS.map((r) => (
          <SectionCard key={r.kind} title={r.label}>
            <View style={styles.chips}>
              <ChipGroup
                options={intervalOptions}
                value={String(settings.items[r.kind]?.days ?? 0)}
                onChange={(v) => v !== null && setInterval(r.kind, Number(v))}
              />
            </View>
          </SectionCard>
        ))}
        <SectionCard title="時刻">
          <View style={styles.chips}>
            <ChipGroup
              options={hourOptions}
              value={String(settings.hour)}
              onChange={(v) => v !== null && save({ ...settings, hour: Number(v) })}
            />
          </View>
        </SectionCard>
      </ScrollView>
      <Snackbar visible={failed} onDismiss={() => setFailed(false)}>
        保存できませんでした
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.screen, gap: SPACING.gap, paddingBottom: 48 },
  chips: { paddingVertical: 8 },
});
