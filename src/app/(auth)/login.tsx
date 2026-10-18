import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

type FormValues = z.infer<typeof schema>;

function loginErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'invalid_credentials':
      return 'メールアドレスかパスワードが違います';
    case 'email_provider_disabled':
      return 'メールでのログインがサーバー側で無効になっています';
    case 'over_request_rate_limit':
      return '試行回数が多すぎます。しばらく待ってからやり直してください';
    case undefined:
      return 'サーバーに接続できませんでした。通信状態を確認してください';
    default:
      return `ログインできませんでした（${code}）`;
  }
}

export default function LoginScreen() {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async ({ email, password }: FormValues) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(loginErrorMessage(error.code));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.form}>
        <Text variant="headlineMedium" style={styles.title}>
          家計簿
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="メールアドレス"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.email}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.email}>
          {errors.email?.message}
        </HelperText>

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="パスワード"
              secureTextEntry
              autoComplete="password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={!!errors.password}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.password || !!error}>
          {errors.password?.message ?? error}
        </HelperText>

        <Button mode="contained" onPress={() => handleSubmit(onSubmit)()} loading={isSubmitting} disabled={isSubmitting}>
          ログイン
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  form: { paddingHorizontal: 24, gap: 4 },
  title: { textAlign: 'center', marginBottom: 24 },
});
