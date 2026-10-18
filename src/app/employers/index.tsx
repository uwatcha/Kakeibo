import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FAB, List, Text, useTheme } from 'react-native-paper';

import { QueryState } from '@/components/QueryState';
import { useEmployers } from '@/features/employers/hooks';
import { paydayLabel } from '@/features/employers/labels';
import { nextPayday } from '@/features/employers/payday';
import { formatDay, toTokyoDateString } from '@/lib/date';

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
          {active.length === 0 && (
            <Text style={styles.empty} variant="bodyMedium">
              働き先がありません
            </Text>
          )}
          {active.map((e) => {
            const next = nextPayday([e], today);
            return (
              <List.Item
                key={e.id}
                title={e.name}
                description={`${paydayLabel(e)}\n次回: ${next ? formatDay(next.date) : '―'}`}
                descriptionNumberOfLines={2}
                left={(props) => <List.Icon {...props} icon="briefcase" />}
                onPress={() => openEmployer(e.id)}
              />
            );
          })}
          {archived.length > 0 && (
            <List.Section title="非表示にした働き先">
              {archived.map((e) => (
                <List.Item key={e.id} title={e.name} description={paydayLabel(e)} onPress={() => openEmployer(e.id)} />
              ))}
            </List.Section>
          )}
        </ScrollView>
      )}
      <FAB icon="plus" label="働き先を追加" style={styles.fab} onPress={() => openEmployer('new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 96 },
  empty: { padding: 24, textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
