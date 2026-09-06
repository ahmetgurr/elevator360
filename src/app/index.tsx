import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePeriodSummary } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { currentPeriod } from '@/lib/format';
import { MODULE_LABEL, type ModuleType } from '@/lib/types';
import { Button, EmptyState, Txt } from '@/components/ui';
import { CashSummaryPanel } from '@/components/ledger';

const MODULE_DESC: Record<ModuleType, string> = {
  elevator: 'Periyodik bakım, arıza, parça değişimi ve aylık tahsilat takibi',
  cleaning: 'Periyodik temizlik, ekstra işler ve aylık tahsilat takibi',
};

export default function ModulePickerScreen() {
  const { profile, modules, signOut } = useAuth();
  const { c, spacing, radius } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const autoNavigated = useRef(false);
  const period = currentPeriod();
  const elevatorSummary = usePeriodSummary('elevator', period, modules.includes('elevator'));
  const cleaningSummary = usePeriodSummary('cleaning', period, modules.includes('cleaning'));

  // Tek modul yetkisi varsa secim ekraninda oyalanma, dogrudan listeye gec.
  // push kullanilir (replace degil): boylece bu ekran yiginda kalir ve
  // "Geri" tusuyla modul secim ekranina donulebilir. autoNavigated kalkani,
  // geri donuldugunde ayni yonlendirmenin tekrar tetiklenip kullaniciyi
  // ileri geri sicratmasini engeller.
  useEffect(() => {
    if (modules.length === 1 && !autoNavigated.current) {
      autoNavigated.current = true;
      router.push(`/${modules[0]}`);
    }
  }, [modules.join(',')]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut} hitSlop={8}>
          <Txt variant="small" color={c.accent}>Çıkış</Txt>
        </Pressable>
      ),
    });
  }, [navigation, c.accent]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Txt variant="h1">Merhaba{profile?.full_name ? `, ${profile.full_name}` : ''}</Txt>
        <Txt variant="small" color={c.textMuted}>Çalışmak istediğiniz modülü seçin.</Txt>
      </View>

      {modules.length > 0 && (
        <CashSummaryPanel
          summaries={[elevatorSummary.data, cleaningSummary.data]}
          loading={elevatorSummary.isLoading || cleaningSummary.isLoading}
        />
      )}

      {modules.length === 0 ? (
        <EmptyState
          title="Henüz modül yetkiniz yok"
          detail="Sistem yöneticisinin hesabınıza asansör ve/veya temizlik modülü yetkisi tanımlaması gerekiyor."
        />
      ) : (
        modules.map(m => (
          <Pressable
            key={m}
            onPress={() => router.push(`/${m}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.surfaceAlt : c.surface,
              borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm,
              borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
              borderLeftWidth: 4, borderLeftColor: c.accent,
            })}
          >
            <Txt variant="h2">{MODULE_LABEL[m]}</Txt>
            <Txt variant="small" color={c.textMuted}>{MODULE_DESC[m]}</Txt>
          </Pressable>
        ))
      )}

      {modules.length > 0 && (
        <Button title="Çıkış yap" variant="ghost" onPress={signOut} style={{ marginTop: spacing.xl }} />
      )}
    </ScrollView>
  );
}
