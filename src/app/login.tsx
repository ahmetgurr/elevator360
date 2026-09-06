import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, Card, Field, Txt } from '@/components/ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { c, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre girilmeli.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message ?? 'Giriş yapılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: c.headerBg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center',
          padding: spacing.xl, paddingTop: insets.top + spacing.xxl, gap: spacing.xxl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Txt variant="h1" color={c.headerText}>Elevator360</Txt>
          <Txt variant="small" color={c.accent}>Bakım ve Tahsilat Takip Sistemi</Txt>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <Field
            label="E-posta"
            value={email}
            onChangeText={t => { setEmail(t); setError(null); }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="ornek@firma.com"
            editable={!busy}
            maxLength={254}
          />
          <Field
            label="Şifre"
            value={password}
            onChangeText={t => { setPassword(t); setError(null); }}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            editable={!busy}
            onSubmitEditing={submit}
            returnKeyType="go"
            error={error ?? undefined}
          />
          <Button title="Giriş yap" onPress={submit} loading={busy} />
        </Card>

        <Txt variant="tiny" color={c.textFaint} style={{ textAlign: 'center' }}>
          Hesabınız yoksa sistem yöneticisiyle iletişime geçin.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
