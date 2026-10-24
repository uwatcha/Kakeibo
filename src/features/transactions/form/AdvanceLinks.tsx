import { type Control, Controller } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Chip, HelperText, Text } from 'react-native-paper';

import { ChipGroup } from '@/components/ChipGroup';
import { formatYen } from '@/lib/money';

import type { Transaction } from '../api';
import type { FormValues } from './values';

// 立て替えと、それを返してもらった貸し金戻りのつなぎ（No.43。2026-10-24 改善要望で、元の支払いから貸し金戻りに変更）。
// 立て替えの related_transaction_id が貸し金戻りを指す。どちらの記録の画面からでもつなげる

const describe = (t: Transaction) =>
  `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))}${t.payee ? ` ${t.payee}` : ''} ${formatYen(t.amount)}`;

/** 立て替えの記録: 返してもらった貸し金戻り（その相手からの、立て替えた日以降のもの）を1つ選ぶ */
export function RepaymentField({ control, collects }: { control: Control<FormValues>; collects: readonly Transaction[] }) {
  return (
    <Controller
      control={control}
      name="relatedTransactionId"
      render={({ field: { onChange, value } }) => {
        const options = collects.map((t) => ({ value: t.id, label: describe(t) }));
        if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: '選択中の貸し金戻り' });
        return (
          <View style={styles.field}>
            <Text variant="labelLarge">返してもらった記録（任意）</Text>
            {options.length > 0 ? (
              <ChipGroup options={options} value={value} onChange={onChange} allowDeselect />
            ) : (
              <HelperText type="info">この相手からの貸し金戻りの記録はありません</HelperText>
            )}
          </View>
        );
      }}
    />
  );
}

/**
 * 貸し金戻りの記録: それで返してもらった立て替えを選ぶ（いくつでも）。
 * 候補は、その相手への立て替えのうち、まだつないでいないものと、この記録につないであるもの
 */
export function RepaidAdvancesField({
  control,
  advances,
  collectId,
}: {
  control: Control<FormValues>;
  advances: readonly Transaction[];
  collectId: string | null;
}) {
  const candidates = advances.filter((t) => !t.related_transaction_id || t.related_transaction_id === collectId);
  return (
    <Controller
      control={control}
      name="repaidAdvanceIds"
      render={({ field: { onChange, value } }) => {
        const total = candidates.filter((t) => value.includes(t.id)).reduce((sum, t) => sum + t.amount, 0);
        return (
          <View style={styles.field}>
            <Text variant="labelLarge">返してもらった立て替え（任意）</Text>
            {candidates.length > 0 ? (
              <>
                <View style={styles.chips}>
                  {candidates.map((t) => {
                    const selected = value.includes(t.id);
                    return (
                      <Chip
                        key={t.id}
                        selected={selected}
                        showSelectedCheck
                        onPress={() => onChange(selected ? value.filter((id) => id !== t.id) : [...value, t.id])}
                      >
                        {describe(t)}
                      </Chip>
                    );
                  })}
                </View>
                {total > 0 && <HelperText type="info">合計 {formatYen(total)}</HelperText>}
              </>
            ) : (
              <HelperText type="info">この相手への立て替えの記録はありません</HelperText>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
