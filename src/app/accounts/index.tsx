import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { AddFab } from '@/components/AddFab';
import { ListRow } from '@/components/ListRow';
import { QueryState } from '@/components/QueryState';
import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, type AccountKind, ACCOUNT_KINDS, PERSON_KINDS } from '@/features/accounts/accountKinds';
import type { Account } from '@/features/accounts/api';
import { useAccounts, useBalanceMap } from '@/features/accounts/hooks';
import { SPACING } from '@/theme';

function openAccount(id: string) {
  router.push({ pathname: '/accounts/[id]', params: { id } });
}

/** 口座の一覧。種類ごとにまとめ、同じ種類の中は名前順（並び順は compareAccounts） */
export default function AccountsScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useAccounts();

  const balances = useBalanceMap();
  const [openPast, setOpenPast] = useState<Partial<Record<AccountKind, boolean>>>({});

  const active = data?.filter((a) => !a.is_archived) ?? [];
  const row = (a: Account) => (
    <ListRow
      key={a.id}
      title={a.name}
      subtitle={[a.is_reserved ? '普段使わない' : null, a.memo].filter(Boolean).join('・') || undefined}
      icon={ACCOUNT_KIND_INFO[a.kind].icon}
      onPress={() => openAccount(a.id)}
    />
  );
  const archived = data?.filter((a) => a.is_archived) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: '口座の管理' }} />
      {!data ? (
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {active.length === 0 && (
            <Text style={styles.empty} variant="bodyMedium">
              口座がありません
            </Text>
          )}
          {ACCOUNT_KINDS.map((kind) => {
            const ofKind = active.filter((a) => a.kind === kind);
            if (ofKind.length === 0) return null;
            // 貸し借りの相手で残高が 0 円の人は「過去の相手」にたたむ
            const isPast = (a: Account) =>
              PERSON_KINDS.includes(kind) && balances !== undefined && (balances.get(a.id) ?? 0) === 0;
            const current = ofKind.filter((a) => !isPast(a));
            const past = ofKind.filter(isPast);
            return (
              <SectionCard key={kind} title={ACCOUNT_KIND_INFO[kind].label}>
                {current.map(row)}
                {past.length > 0 && (
                  <>
                    <TouchableRipple
                      onPress={() => setOpenPast({ ...openPast, [kind]: !openPast[kind] })}
                      accessibilityState={{ expanded: !!openPast[kind] }}
                    >
                      <View style={styles.pastToggle}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          過去の相手（{past.length}）
                        </Text>
                        <MaterialCommunityIcons
                          name={openPast[kind] ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.colors.onSurfaceVariant}
                        />
                      </View>
                    </TouchableRipple>
                    {openPast[kind] && past.map(row)}
                  </>
                )}
              </SectionCard>
            );
          })}
          {archived.length > 0 && (
            <SectionCard title="非表示にした口座">
              {archived.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.name}
                  subtitle={ACCOUNT_KIND_INFO[a.kind].label}
                  icon={ACCOUNT_KIND_INFO[a.kind].icon}
                  iconColor={theme.colors.onSurfaceVariant}
                  onPress={() => openAccount(a.id)}
                />
              ))}
            </SectionCard>
          )}
        </ScrollView>
      )}
      <AddFab label="口座を追加" onPress={() => openAccount('new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 96 },
  empty: { padding: 24, textAlign: 'center' },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.row,
    paddingVertical: 10,
  },
});
