import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { Amount } from '@/components/Amount';
import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import type { Movement } from '@/features/reports/api';
import type { Shortage, ShortageCover } from '@/features/reports/shortage';
import { TRANSACTION_RULES } from '@/features/transactions/transactionRules';
import { formatDay } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { cautionColor } from '@/theme';

type Props = {
  shortages: readonly Shortage<Movement>[];
  covers: ReadonlyMap<string, ShortageCover>;
  accountName: (id: string | null) => string;
};

const openTransaction = (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } });
const openTransfer = (from: string, to: string, amount: number) =>
  router.push({
    pathname: '/transaction/[id]',
    params: { id: 'new', transferFrom: from, transferTo: to, amount: String(amount) },
  });

/**
 * 入っている予定で残高がマイナスになる口座（REQ-25）。
 * 振替で切り抜けられるなら黄色で振替元と額（押すとその振替を記録する画面）、どこから振り替えても足りなければ赤
 */
export function ShortageCard({ shortages, covers, accountName }: Props) {
  const theme = useTheme();
  if (shortages.length === 0) return null;
  const anyAbsolute = shortages.some((s) => !covers.get(s.accountId)?.covered);
  const caution = cautionColor(theme.dark);
  // 支払い先が口座（クレカ・貸し借りの相手）ならその名前、なければ内容、それもなければ記録の種類
  const causeLabel = (m: Movement) =>
    (m.to_account_id ? accountName(m.to_account_id) : null) || m.payee || TRANSACTION_RULES[m.type].label;

  return (
    <SectionCard
      title="足りなくなる口座"
      left={
        <MaterialCommunityIcons
          name={anyAbsolute ? 'alert' : 'alert-outline'}
          size={22}
          color={anyAbsolute ? theme.colors.error : caution}
        />
      }
    >
      {shortages.map((s) => {
        const cover = covers.get(s.accountId);
        const covered = !!cover?.covered;
        return (
          <ListRow
            key={s.accountId}
            title={accountName(s.accountId)}
            subtitle={
              <View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatDay(s.date)}
                </Text>
                {/* その日に足りなくなる原因の支払い。複数あるときは、それぞれの行を押すとその予定を開く */}
                {s.causes.map((m) => (
                  <Text
                    key={m.id}
                    variant="bodySmall"
                    numberOfLines={1}
                    onPress={s.causes.length > 1 ? () => openTransaction(m.id) : undefined}
                  >
                    {causeLabel(m)} {formatYen(m.amount)}
                  </Text>
                ))}
                {covered &&
                  cover!.sources.map((src) => (
                    <Text
                      key={src.accountId}
                      variant="bodySmall"
                      numberOfLines={1}
                      style={[styles.bold, { color: caution }]}
                      onPress={() => openTransfer(src.accountId, s.accountId, src.amount)}
                    >
                      {accountName(src.accountId)}から {formatYen(src.amount)} を振替
                    </Text>
                  ))}
              </View>
            }
            right={
              <Amount
                value={s.lowest}
                variant="bodyLarge"
                style={covered ? [styles.bold, { color: caution }] : styles.bold}
              />
            }
            // 足りなくなる原因の支払い予定を開く（複数なら一番大きいもの）
            onPress={() => {
              const main = [...s.causes].sort((a, b) => b.amount - a.amount)[0];
              if (main) openTransaction(main.id);
              else router.push({ pathname: '/accounts/[id]', params: { id: s.accountId } });
            }}
          />
        );
      })}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
});
