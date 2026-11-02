import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useTheme } from 'react-native-paper';

import { ListRow } from '@/components/ListRow';
import { SectionCard } from '@/components/SectionCard';
import {
  useAutoAdded,
  useEmailImportSettings,
  useEmailImportSources,
  useNeedsPayee,
  useNotOnStatement,
  useOpenImports,
} from '@/features/emailImport/hooks';
import { useUnconfirmed } from '@/features/transactions/hooks';
import { warningColors } from '@/theme';

/** Apps Script からこれより長く届いていなければ、止まっていると知らせる */
const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * ホームの上の、確かめる記録のカード。件数があるものだけ並べ、押すと「記録の確認」のそのタブを開く。
 * メールからの記録の AI 待ち（処理中）と、Gmail からの読み取りが止まっていることもここに出す
 */
export function ReviewCard({ today, now }: { today: string; now: number }) {
  const theme = useTheme();
  const unconfirmed = useUnconfirmed(today);
  const autoAdded = useAutoAdded();
  const open = useOpenImports();
  const needsPayee = useNeedsPayee();
  const notOnStatement = useNotOnStatement();
  const settings = useEmailImportSettings();
  const sources = useEmailImportSources();

  const warning = warningColors(theme.dark).color;
  const chevron = <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />;
  const openTab = (tab: string) => router.push({ pathname: '/unconfirmed', params: { tab } });

  const duplicates = open.data?.filter((i) => i.status === 'duplicate').length ?? 0;
  const pendingAi = open.data?.filter((i) => i.status === 'pending_ai').length ?? 0;
  const linked = !!settings.data?.token_hash && (sources.data ?? []).some((s) => s.enabled && s.account_id);
  const lastSeen = settings.data?.last_seen_at ? new Date(settings.data.last_seen_at).getTime() : null;
  const stopped = linked && (lastSeen === null || now - lastSeen > STALE_MS);

  const rows = [
    {
      key: 'unconfirmed',
      count: unconfirmed.data?.length ?? 0,
      title: '未確認の記録',
      icon: 'alert-circle-outline',
      color: warning,
    },
    {
      key: 'payee',
      count: needsPayee.data?.length ?? 0,
      title: '内容が分からない記録',
      icon: 'help-circle-outline',
      color: warning,
    },
    { key: 'duplicate', count: duplicates, title: '重複の可能性', icon: 'content-duplicate', color: warning },
    {
      key: 'statement',
      count: notOnStatement.data?.length ?? 0,
      title: '明細にない記録',
      icon: 'file-question-outline',
      color: warning,
    },
    {
      key: 'auto',
      count: autoAdded.data?.length ?? 0,
      title: '自動で追加した記録',
      icon: 'email-check-outline',
      color: undefined,
    },
  ].filter((r) => r.count > 0);

  if (rows.length === 0 && pendingAi === 0 && !stopped) return null;
  return (
    <SectionCard>
      {rows.map((r) => (
        <ListRow
          key={r.key}
          title={`${r.title} ${r.count}件`}
          icon={r.icon}
          iconColor={r.color}
          right={chevron}
          onPress={() => openTab(r.key)}
        />
      ))}
      {pendingAi > 0 && (
        <ListRow
          title={`メールからの記録 ${pendingAi}件を処理中`}
          icon="progress-clock"
          iconColor={theme.colors.onSurfaceVariant}
        />
      )}
      {stopped && (
        <ListRow
          title="メールの読み取りが止まっています"
          icon="email-off-outline"
          iconColor={theme.colors.error}
          right={chevron}
          onPress={() => router.push('/email-import')}
        />
      )}
    </SectionCard>
  );
}
