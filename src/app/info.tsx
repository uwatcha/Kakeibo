import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { SectionCard } from '@/components/SectionCard';
import { ACCOUNT_KIND_INFO, type AccountKind } from '@/features/accounts/accountKinds';
import { TRANSACTION_RULES, type TransactionType } from '@/features/transactions/transactionRules';
import { SPACING } from '@/theme';

type Term = { term: string; description: string };

const BALANCE_TERMS: Term[] = [
  {
    term: '汎用資産',
    description:
      '「汎用資産に含める」とした口座の残高の合計です。ホーム・集計の右上のつまみのアイコンから、口座ごとにスイッチで切り替えられ、すぐに反映されます。パネルでは普段使わない口座を下にまとめています。クレカの未払いや借りているお金は、含めるとマイナスとして差し引かれます。給料日までに使える額・月末の見込み・給料日からの推移も、ここで選んだ口座で計算します。',
  },
  {
    term: '給料日までに使える額',
    description:
      'ホームのカードの3枚目です。汎用資産に、次の給料日の前日までの予定（未来の日付の記録。定期支払いで追加した分も含む）を反映した額です。働き先を登録していないときは月末までで計算し「月末までに使える額」と出します。1日あたりの額は、今日を含めた残り日数で割った額です。',
  },
  {
    term: '月末の見込み',
    description:
      'ホームのカードの4枚目です。汎用資産に、月末までの予定（未来の日付の記録・定期支払い。給料など入金の予定も含む）を反映した額です。',
  },
  {
    term: '純資産',
    description:
      'すべての口座の残高の合計です。残高は今日までの記録で計算し、未来の日付の記録（予定）は含めません。クレカの未払い・借りているお金はマイナスとして差し引きます。非表示にした口座も含みます。',
  },
  {
    term: '普段使う口座 / 普段使わない口座',
    description:
      '現金・銀行・電子マネー・投資の口座は、口座の編集画面で「普段使わない口座」にできます（NISA・タンス貯金など）。ホームでは折りたたんだ別枠に表示します。汎用資産に含めるかどうかは別に選びます（口座を作るときは、普段使わない口座なら含めない状態から始まります）。',
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
    term: '締め日・引き落とし日',
    description:
      'クレジットカードの口座の編集画面から設定します。31日と入れると月末として扱い、引き落とし日が土日祝・年末年始のときは次の平日になります。設定画面に次の引き落とし日と、その請求の締め日が出ます。',
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
    term: '定期支払い',
    description:
      '設定の「定期支払い」で、毎月（または2か月ごと）の支払い・収入・振替を登録すると、アプリを開いたときに31日先までの分を記録として自動で追加します。今日より後の日付の記録は予定として一覧に出し、その日まで残高には入りません。休みの日は「そのまま／前の平日／次の平日」から選べます。「動かす」を切ると追加しなくなり、また動かしたときも止めていた間の分はさかのぼって追加しません。',
  },
  {
    term: '自動で追加された記録',
    description:
      '記録一覧で「（定期）」が付いている記録です。記録の編集画面のボタンから元の定期支払いを開けます。定期支払いの画面には追加した記録の一覧があり、間違えて登録したときは「追加した記録をまとめて削除」で消せます。1件ずつ消した記録は作り直しません。定期支払いの金額や日を変えると、今日より後の予定は消して作り直します。',
  },
  {
    term: '足りなくなる口座',
    description:
      '現金・銀行・電子マネー・投資の口座について、この先31日の予定（未来の日付の記録・定期支払い）を日付順に反映し、途中で残高がマイナスになる口座をホームの上に出します。日付は初めてマイナスになる日、その下はその日にその口座から出ていく予定（足りなくなる原因の支払い）、右の金額はその期間でいちばん低い残高です。押すとその支払いの予定を開きます（複数あるときは、支払いの行を押すとそれぞれを開けます）。同じ日の入金と支払いは差し引きで判断します。',
  },
  {
    term: '重複の確認',
    description:
      '新しい記録を保存するとき、同じ日・同じ金額の記録がすでにあれば、その記録を見せて保存するか確かめます。',
  },
  {
    term: 'データの書き出し',
    description:
      '設定の「データ」から、記録を CSV（表計算ソフトで開ける形式）で、またはすべてのデータをバックアップ（JSON）で書き出し、共有画面から Google ドライブなどに保存できます。',
  },
  {
    term: '並べ替え',
    description:
      '口座は種類の順（現金・銀行・電子マネー・投資・クレジットカード・借りている相手・貸している相手）、同じ種類の中は名前順に並びます。大分類は、行の右のつまみを押したまま上下に動かすか、行を長押しして動かします。小分類は、大分類の編集画面の「小分類」で同じように並べ替えます。',
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
  {
    term: 'ポイント',
    description:
      '記録の入力画面の「ポイント」に、本来の金額と利用ポイントを記録できます（空欄でもよい）。「金額」は実際に払った額で、残高と集計にはこちらを使います。',
  },
  {
    term: 'カテゴリの自動入力',
    description:
      '支払い・収入でカテゴリを選ばずに「内容」を入れると、同じ内容の過去の記録でいちばん多く使ったカテゴリが自動で選ばれます。支払いでは、口座に「既定のカテゴリ」があれば口座を選んだときにそれが入ります（内容から予測できたときは内容の方を優先）。自分で選んだカテゴリは変わりません。',
  },
  {
    term: '予定',
    description:
      '今日より後の日付の記録です。その日が来るまで残高には入りません。記録の一覧では上にまとめて破線の枠で表示し、開いたときは今日以前の記録から見えるようにしています。上にスクロールすると予定が見られます。',
  },
  {
    term: '未確認',
    description:
      '予定として入れた記録（未来の日付で入れたもの・定期支払いで追加したもの）は、日付が来ると「未確認」の印が付きます。実際にそのとおりだったら、記録を開いて「確認した」を押すと印が消えます。金額などを直して保存しても確認したことになります。未確認でも残高には入っています。',
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
      '口座の編集画面の残高の欄には、今日までの記録で計算した残高（クレカは未払い額、借金は借りている額）が入っています。実際の額に書き換えて保存すると、差額を今日の日付の「残高調整」として記録します。初期残高は変わりません。',
  },
  {
    term: '口座の利用履歴',
    description:
      'ホームで口座を押すと、その口座から出た・入った記録が日ごとに出ます。金額はその口座から見た増減（入ったら +、出たら −）です。右上の鉛筆から口座の編集へ進めます。',
  },
  {
    term: '引き落とし（クレジットカード）',
    description:
      'クレカの利用履歴の「引き落とし」に、引き落とし日ごとの額を出します。締め日までの利用を合計したもので、まだ締めていない回は「締め前」と出て、これからの利用で増えます。使い始めたときの未払い額は、最初の引き落としの回に入れています。',
  },
  {
    term: '既定のカテゴリ',
    description:
      '口座の編集画面で選べます（Suica なら交通など）。支払いを記録するときに、その口座を選ぶと自動で入ります。',
  },
  {
    term: '内容の候補',
    description:
      '記録の「内容」を入力している間、入力した文字を含む過去の内容が、よく使う順に下に出ます。押すとそれが入ります。',
  },
  { term: '初期残高', description: '使い始める日の実際の残高です。クレカは未払い額、借金は借りている額を入れます。' },
];

function TermItem({ term, description }: Term) {
  const theme = useTheme();
  return (
    <View style={styles.term}>
      <Text variant="titleSmall" style={styles.termTitle}>
        {term}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {description}
      </Text>
    </View>
  );
}

export default function InfoScreen() {
  const theme = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <SectionCard title="残高">
        {BALANCE_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </SectionCard>
      <SectionCard title="口座の種類">
        {(Object.keys(ACCOUNT_DESCRIPTIONS) as AccountKind[]).map((kind) => (
          <TermItem key={kind} term={ACCOUNT_KIND_INFO[kind].label} description={ACCOUNT_DESCRIPTIONS[kind]} />
        ))}
      </SectionCard>
      <SectionCard title="記録の種類">
        {(Object.keys(TYPE_DESCRIPTIONS) as TransactionType[]).map((type) => (
          <TermItem key={type} term={TRANSACTION_RULES[type].label} description={TYPE_DESCRIPTIONS[type]} />
        ))}
      </SectionCard>
      <SectionCard title="そのほか">
        {OTHER_TERMS.map((t) => (
          <TermItem key={t.term} {...t} />
        ))}
      </SectionCard>
      <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
        金額はすべて円単位、日付は日本時間です。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.screen, paddingTop: 4, gap: SPACING.gap, paddingBottom: 32 },
  term: { paddingHorizontal: SPACING.row, paddingVertical: 8, gap: 2 },
  termTitle: { fontWeight: '700' },
  footer: { paddingHorizontal: 4 },
});
