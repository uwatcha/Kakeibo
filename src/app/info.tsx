import { ScrollView, StyleSheet, View } from 'react-native';
import { Divider, List, Text, useTheme } from 'react-native-paper';

import { ACCOUNT_KIND_INFO, type AccountKind } from '@/features/accounts/accountKinds';
import { TRANSACTION_RULES, type TransactionType } from '@/features/transactions/transactionRules';

type Term = { term: string; description: string };

const BALANCE_TERMS: Term[] = [
  {
    term: '汎用資産',
    description:
      '純資産から「普段使わない口座」を除いた額です。クレカの未払いや借りているお金は差し引き、貸しているお金は含めます。日々自由に使えるお金の目安です。',
  },
  {
    term: '純資産',
    description:
      'すべての口座の残高の合計です。残高は今日までの記録で計算し、未来の日付の記録（予定）は含めません。クレカの未払い・借りているお金はマイナスとして差し引きます。非表示にした口座も含みます。',
  },
  {
    term: '普段使う口座 / 普段使わない口座',
    description:
      '現金・銀行・電子マネー・投資の口座は、口座の編集画面で「普段使わない口座」にできます（NISA・タンス貯金など）。ホームでは折りたたんだ別枠に表示し、汎用資産には含めません。',
  },
  {
    term: '未払い（クレジットカード）',
    description:
      'カードで使ったうち、まだ銀行から引き落とされていない額です。ホームではマイナスの残高として表示します。',
  },
];

const ACCOUNT_DESCRIPTIONS: Record<AccountKind, string> = {
  cash: '財布やタンス貯金などの現金',
  bank: '銀行口座',
  emoney: 'Suica などの電子マネー',
  investment: 'NISA などの投資。残高は評価額を入れます',
  credit_card: '使った額が未払いとして積み上がり、引き落としで減ります',
  payable: '親など、お金を借りている相手。借りている額がマイナスの残高になります',
  receivable: '立て替えたり貸したりしている相手。返してもらう額が残高になります',
};

const TYPE_DESCRIPTIONS: Record<TransactionType, string> = {
  expense: 'お店などへの支払い。クレカで払ったときは支払い元をクレカにします',
  income: '仕送り・バイト代など',
  transfer: '自分の口座どうしの移動。ATM、Suica のチャージ、銀行からのクレカ引き落とし',
  advance: '人の分を代わりに払ったとき。割り勘は「自分の分は支払い、相手の分は立て替え」の2件に分けます',
  lend: 'お金を貸したとき',
  collect: '立て替えた分・貸した分が返ってきたとき',
  borrow: 'お金を借りたとき',
  repay: '借りたお金を返したとき',
  adjustment: 'アプリの残高と実際の残高のずれを合わせるとき',
};

const OTHER_TERMS: Term[] = [
  {
    term: '集計に入る記録',
    description:
      '月の収入・支出に数えるのは「支払い」と「収入」だけです。振替・立て替え・貸し借り・残高調整は自分のお金の置き場所が変わるだけなので、支出には入りません。',
  },
  {
    term: 'クレジットカードの記録',
    description:
      '使った日に「支払い」（支払い元＝カード）、引き落とし日に「振替」（銀行 → カード）を記録します。支出は使った日に1回だけ数えます。',
  },
  {
    term: '大分類 / 小分類',
    description:
      'カテゴリは2階層です（例: 食費 / 外食）。集計のグラフは大分類でまとめます。小分類を選ばず大分類だけで記録することもできます。',
  },
  {
    term: '給料日',
    description:
      '設定の「働き先と給料日」で登録します。決めた日が土日祝・年末年始（12/31〜1/3）のときは、働き先ごとに選んだ向き（前の平日／次の平日）へ自動でずらします。31日と入れると月末（30日・28日の月も月末）として扱います。編集画面には、ずらした後の実際の給料日がこれから3回分出ます。辞めた働き先は非表示にします。',
  },
  {
    term: '給料日からの推移',
    description:
      '集計画面のグラフ（横にスワイプした2枚目）です。登録した働き先のうち、いちばん最近の給料日から次の給料日までの汎用資産を日ごとに表示します。今日までが実績の線、その先の点線は給料日から今日までの1日あたりの平均の増減がそのまま続いた場合の予測で、次の給料日時点の予測額に横線を引き、左の目盛りの位置に金額を出します。今日が給料日の日は、翌日から線が出ます。働き先を登録していないときは、登録ボタンが出ます。',
  },
  {
    term: 'カテゴリ別の支出',
    description:
      '集計画面の一覧です。カテゴリをタップすると、その月・そのカテゴリ（小分類も含む）の支出だけに絞った記録一覧が開きます。',
  },
  {
    term: '入力画面の口座',
    description:
      '記録の種類に合う口座だけが選べます。種類ごとに、前回使った口座が最初から選ばれます。選べる口座がないときは、設定 → 口座の管理から追加します。',
  },
  {
    term: '追加のしかた',
    description:
      '口座・カテゴリ・働き先は、設定のそれぞれの画面の右下の「＋」から追加します。記録は、ホームか記録タブの右下の「＋」から入力します。',
  },
  {
    term: '並べ替え',
    description:
      '口座と大分類は、行の右のつまみを押したまま上下に動かすか、行を長押しして動かします。小分類は、大分類の編集画面の「小分類」で同じように並べ替えます。',
  },
  {
    term: '記録の検索',
    description: '記録タブの右上の虫めがねから、すべての期間の記録を内容・メモ・カテゴリ名・金額で探せます。',
  },
  {
    term: '口座の種類の変更',
    description:
      '口座の種類（現金・クレジットカードなど）は、作成した後は変更できません。過去の記録との組み合わせが崩れないようにするためです。',
  },
  {
    term: '記録の削除',
    description: '記録の編集画面の右上のごみ箱から削除します。削除すると元に戻せず、残高と集計からも消えます。',
  },
  {
    term: '金額の色と符号',
    description:
      '残高はマイナスのときだけ赤で「−」を付けます（クレカの未払いや借りているお金もマイナスで表示）。記録一覧では、収入は緑で「+」、支出は「−」、振替・立て替え・貸し借り・残高調整は灰色で符号を付けません。差額や前月比は必ず符号を付け、増えたら緑、減ったら赤にします。',
  },
  { term: '未分類', description: 'カテゴリを選ばずに記録した支払い・収入です。' },
  {
    term: '非表示',
    description:
      '口座・カテゴリ・働き先は削除せず非表示にします。入力画面に出なくなりますが、過去の記録・残高・集計には残り、口座は純資産にも含まれます。大分類を非表示にすると、その小分類も入力画面に出なくなります。',
  },
  {
    term: '残高を合わせる',
    description:
      '口座の編集画面のボタンから、実際の残高（クレカは未払い額、借金は借りている額）を入れると、アプリの残高との差額を今日の日付の「残高調整」として記録します。',
  },
  { term: '初期残高', description: '使い始める日の実際の残高です。クレカは未払い額、借金は借りている額を入れます。' },
];

function TermItem({ term, description }: Term) {
  return <List.Item title={term} titleStyle={styles.term} description={description} descriptionNumberOfLines={0} />;
}

export default function InfoScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <List.Section title="残高">
        {BALANCE_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </List.Section>
      <Divider />
      <List.Section title="口座の種類">
        {(Object.keys(ACCOUNT_DESCRIPTIONS) as AccountKind[]).map((kind) => (
          <TermItem key={kind} term={ACCOUNT_KIND_INFO[kind].label} description={ACCOUNT_DESCRIPTIONS[kind]} />
        ))}
      </List.Section>
      <Divider />
      <List.Section title="記録の種類">
        {(Object.keys(TYPE_DESCRIPTIONS) as TransactionType[]).map((type) => (
          <TermItem key={type} term={TRANSACTION_RULES[type].label} description={TYPE_DESCRIPTIONS[type]} />
        ))}
      </List.Section>
      <Divider />
      <List.Section title="そのほか">
        {OTHER_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </List.Section>
      <View style={styles.footer}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          金額はすべて円単位、日付は日本時間です。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  term: { fontWeight: 'bold' },
  footer: { paddingHorizontal: 16 },
});
