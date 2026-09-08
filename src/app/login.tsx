import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { glassColors, useTheme } from '@/lib/theme';
import { Field, Txt } from '@/components/ui';
import { GlassBackground, GlassCard, GradientButton, bounceScrollProps } from '@/components/Glass';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { spacing } = useTheme();

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
    <GlassBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, justifyContent: 'center',
            padding: spacing.xl, gap: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          {...bounceScrollProps}
        >
          {/* Logo GORSELI zaten "MIZAN" yazisini icinde barindiriyor — ayrica
              buyuk bir metin basligi eklemek (eski hali) acilis (splash)
              ekranindan hemen sonra "Mizan" ismini İKİ FARKLI bicimde arka
              arkaya gostererek "iki kere yaziyor gibi" bir izlenim
              yaratiyordu (bkz. kullanici geri bildirimi). Simdi TEK, tutarli
              bir gorsel kimlik: splash'taki AYNI logo buraya da tasinir. */}
          <View style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Image
              source={require('../../assets/images/logoandsplash.png')}
              style={{ width: 140, height: 140 * (333 / 289) }}
              resizeMode="contain"
            />
            <Txt variant="small" color={glassColors.primaryLight}>Bakım ve Tahsilat Takip Sistemi</Txt>
          </View>

          <GlassCard contentStyle={{ gap: spacing.lg }}>
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
            <GradientButton title="Giriş yap" onPress={submit} loading={busy} chevron={false} />
          </GlassCard>

          <Txt variant="tiny" color={glassColors.textSecondary} style={{ textAlign: 'center' }}>
            Hesabınız yoksa sistem yöneticisiyle iletişime geçin.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}
