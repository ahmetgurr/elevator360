import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePeriodSummary, useProjectedSummary } from '@/lib/api';
import { glassColors, useTheme } from '@/lib/theme';
import { currentPeriod, formatGreetingName, isFuturePeriod, timeGreeting } from '@/lib/format';
import { MODULE_LABEL, type ModuleType } from '@/lib/types';
import { Txt, confirmDestructive } from '@/components/ui';
import { CashSummaryPanel } from '@/components/ledger';
import { GlassBackground, GlassCard, androidRipple, pressScaleStyle, bounceScrollProps } from '@/components/Glass';

const MODULE_DESC: Record<ModuleType, string> = {
  elevator: 'Periyodik bakım, arıza, parça değişimi ve aylık tahsilat takibi',
  cleaning: 'Periyodik temizlik, ekstra işler ve aylık tahsilat takibi',
};

const MODULE_ICON: Record<ModuleType, string> = {
  elevator: '🛗',
  cleaning: '🧹',
};

const MODULE_ICON_BG: Record<ModuleType, string> = {
  elevator: 'rgba(34,197,94,0.28)',
  cleaning: 'rgba(37,99,235,0.28)',
};

export default function ModulePickerScreen() {
  const { profile, modules, signOut } = useAuth();
  const { spacing } = useTheme();
  const router = useRouter();
  const autoNavigated = useRef(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [rangeOpen, setRangeOpen] = useState(false);
  const future = isFuturePeriod(period);
  const elevatorSummary = usePeriodSummary('elevator', period, modules.includes('elevator'));
  const cleaningSummary = usePeriodSummary('cleaning', period, modules.includes('cleaning'));
  const elevatorProjected = useProjectedSummary('elevator', period, modules.includes('elevator') && future);
  const cleaningProjected = useProjectedSummary('cleaning', period, modules.includes('cleaning') && future);
  const summaryEntries = [
    { module: 'elevator' as ModuleType, summary: elevatorSummary.data },
    { module: 'cleaning' as ModuleType, summary: cleaningSummary.data },
  ].filter(e => modules.includes(e.module));
  const projectedEntries = [
    { module: 'elevator' as ModuleType, projected: elevatorProjected.data },
    { module: 'cleaning' as ModuleType, projected: cleaningProjected.data },
  ].filter(e => modules.includes(e.module));
  const displayName = formatGreetingName(profile?.full_name);

  function handleSignOut() {
    confirmDestructive('Çıkış Yap', 'Uygulamadan çıkmak istediğinize emin misiniz?', 'Çıkış', signOut);
  }

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

  return (
    <GlassBackground>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }} {...bounceScrollProps}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <View style={styles.logoBadge}>
              <Txt variant="h3" color={glassColors.textPrimary}>▲</Txt>
            </View>
            <Txt variant="h3" color={glassColors.textPrimary}>Elevator360</Txt>
          </View>
          <Pressable
            onPress={handleSignOut} hitSlop={8}
            android_ripple={{ ...androidRipple, borderless: true }}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed && Platform.OS !== 'ios' ? 0.7 : 1 }, pressScaleStyle(pressed)]}
          >
            <Txt variant="h3" color={glassColors.textPrimary}>⎋</Txt>
          </Pressable>
        </View>

        <Txt variant="h1" color={glassColors.textPrimary}>
          {timeGreeting()} {displayName || ''} 👋
        </Txt>

        {modules.length === 0 ? (
          <GlassCard>
            <View style={{ gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.lg }}>
              <Txt variant="h3" color={glassColors.textPrimary}>Henüz modül yetkiniz yok</Txt>
              <Txt variant="small" color={glassColors.textSecondary} style={{ textAlign: 'center' }}>
                Sistem yöneticisinin hesabınıza asansör ve/veya temizlik modülü yetkisi tanımlaması gerekiyor.
              </Txt>
            </View>
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <CashSummaryPanel
                entries={summaryEntries}
                projectedEntries={projectedEntries}
                loading={elevatorSummary.isLoading || cleaningSummary.isLoading}
                period={period}
                onPeriodChange={setPeriod}
                rangeOpen={rangeOpen}
                onOpenRange={() => setRangeOpen(true)}
                onCloseRange={() => setRangeOpen(false)}
              />
            </GlassCard>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {modules.map(m => (
                <Pressable
                  key={m} onPress={() => router.push(`/${m}`)}
                  android_ripple={androidRipple}
                  style={({ pressed }) => [{ flex: 1, borderRadius: 24 }, pressScaleStyle(pressed)]}
                >
                  <GlassCard style={{ flex: 1 }} contentStyle={{ gap: spacing.sm, minHeight: 168, justifyContent: 'space-between' }}>
                    <View style={[styles.moduleIconBadge, { backgroundColor: MODULE_ICON_BG[m] }]}>
                      <Txt style={styles.moduleIconGlyph}>{MODULE_ICON[m]}</Txt>
                    </View>
                    <View style={{ gap: 2 }}>
                      <Txt variant="h3" color={glassColors.textPrimary} numberOfLines={1}>{MODULE_LABEL[m]}</Txt>
                      <Txt variant="tiny" color={glassColors.textSecondary} numberOfLines={2}>{MODULE_DESC[m]}</Txt>
                    </View>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: glassColors.cardBg, borderWidth: 1, borderColor: glassColors.cardBorder,
    overflow: 'hidden',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: glassColors.cardBg, borderWidth: 1, borderColor: glassColors.cardBorder,
  },
  moduleIconBadge: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  moduleIconGlyph: {
    fontSize: 20, lineHeight: 24, textAlign: 'center',
  },
});
