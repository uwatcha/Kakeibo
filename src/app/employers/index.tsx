import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { useEmployers } from '@/features/employers/hooks';
import { paydayLabel } from '@/features/employers/labels';
import { nextPayday } from '@/features/employers/payday';
import { formatDay, toTokyoDateString } from '@/lib/date';
import { SPACING } from '@/theme';

function openEmployer(id: string) {
  router.push({ pathname: '/employers/[id]', params: { id } });
}

export default function EmployersScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useEmployers();
  const today = toTokyoDateString();

  const active = data?.filter((e) => !e.is_archived) ?? [];
  const archived = data?.filter((e) => e.is_archived) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '働き先と給料日' }} />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {active.length === 0 ? (
            <Text style={styles.empty} variant="bodyMedium">
              働き先がありません
            </Text>
          ) : (
            <SectionCard>
              {active.map((e) => {
                const next = nextPayday([e], today);
                return (
                  <ListRow
                    key={e.id}
                    title={e.name}
                    subtitle={`${paydayLabel(e)}・次回 ${next ? formatDay(next.date) : '―'}`}
                    icon="briefcase"
                    onPress={() => openEmployer(e.id)}
                  />
                );
              })}
            </SectionCard>
          )}
          {archived.length > 0 && (
            <SectionCard title="非表示にした働き先">
              {archived.map((e) => (
                <ListRow
                  key={e.id}
                  title={e.name}
                  subtitle={paydayLabel(e)}
                  icon="briefcase-outline"
                  iconColor={theme.colors.onSurfaceVariant}
                  onPress={() => openEmployer(e.id)}
                />
              ))}
            </SectionCard>
          )}
        </ScrollView>
      )}
      <AddFab label="働き先を追加" onPress={() => openEmployer('new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 96 },
  empty: { padding: 24, textAlign: 'center' },
});
