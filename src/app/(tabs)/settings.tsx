import { StyleSheet, View } from 'react-native';
import { Button, List, useTheme } from 'react-native-paper';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Item title="ログイン中" description={session?.user.email} left={(props) => <List.Icon {...props} icon="account" />} />
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
