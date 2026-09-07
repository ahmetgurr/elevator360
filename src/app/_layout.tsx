import React, { useEffect } from 'react';
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { glassColors } from '@/lib/theme';
import { Loading } from '@/components/ui';
import { GlassBackground } from '@/components/Glass';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Oturum yoksa girise, varsa uygulamaya yonlendirir. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    if (!session && !onLogin) router.replace('/login');
    else if (session && onLogin) router.replace('/');
  }, [session, loading, segments]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Loading label="Oturum kontrol ediliyor…" />
      </SafeAreaView>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemedShell />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * React Navigation'in varsayilan temasi ekran govdesine opak bir
 * rgb(242,242,242) arka plan boyuyor (bkz. DefaultTheme.colors.background) —
 * bu, altimizdaki GlassBackground fotografini tamamen kapatiyordu. Navigator
 * govdesini de seffaf yapan ozel bir tema tanimlariz.
 */
const transparentNavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' },
};

/**
 * Buzlu cam arka plan TEK SEFER burada, tum Stack navigator'un ALTINA
 * monte edilir — ekranlar arasi gecislerde arka plan kesintisiz akar
 * (her ekran kendi ImageBackground'ini tasimaz). Stack'in kendisi ve
 * native header'lar tamamen seffaf; icerik dogrudan fotografin uzerinde
 * "yuzer" (bkz. GlassCard kullanimlarindaki buzlu kartlar).
 */
function ThemedShell() {
  return (
    <GlassBackground safeArea={false}>
      <AuthGate>
        <StatusBar style="light" />
        <ThemeProvider value={transparentNavTheme}>
          <Stack
            screenOptions={{
              headerTransparent: true,
              headerShadowVisible: false,
              headerStyle: { backgroundColor: 'transparent' },
              headerTintColor: glassColors.textPrimary,
              headerTitleStyle: { fontWeight: '700', color: glassColors.textPrimary },
              headerTitleAlign: 'left',
              contentStyle: { backgroundColor: 'transparent' },
              // Native'de (Expo Go) her ekran ayri bir native katman olarak
              // kaydirilir; ikisi de seffaf oldugu icin varsayilan
              // slide_from_right sirasinda alttaki ekran uzerinden gecici
              // olarak "gorunur" hale gelip ust uste biniyordu (bkz.
              // kullanici geri bildirimi). fade, ayni fotografin uzerinde
              // capraz gecis yaptigi icin bu sizintiyi gorunmez kilar.
              animation: 'fade',
            }}
          >
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="[module]/index" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </AuthGate>
    </GlassBackground>
  );
}
