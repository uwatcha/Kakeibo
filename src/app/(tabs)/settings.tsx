import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, List, useTheme } from 'react-native-paper';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Item
        title="口座の管理"
        description="追加・編集・並べ替え・非表示"
        left={(props) => <List.Icon {...props} icon="wallet" />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        onPress={() => router.push('/accounts')}
      />
      <List.Item
        title="カテゴリの管理"
        description="追加・名前の変更・並べ替え・非表示"
        left={(props) => <List.Icon {...props} icon="shape" />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        onPress={() => router.push('/categories')}
      />
      <List.Item
        title="ログイン中"
        description={session?.user.email}
        left={(props) => <List.Icon {...props} icon="account" />}
      />
      <Button mode="outlined" style={styles.logout} onPress={() => supabase.auth.signOut()}>
        ログアウト
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logout: { margin: 16 },
});
