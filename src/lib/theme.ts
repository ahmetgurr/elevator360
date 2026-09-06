/**
 * Elevator360 tasarim sistemi.
 * Koyu lacivert + altin kimlik (Asansör). Temizlik modulu, kullanicinin
 * yanlis module veri girmesini engellemek icin AYRI bir vurgu renginde
 * (soft teal/yesil) calisir — bkz. ModuleThemeProvider. Tum renkler token
 * uzerinden kullanilir; bilesenlerde ham hex yazilmaz.
 */
import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import type { ModuleType } from './types';

const palette = {
  navy900: '#0B1526',
  navy800: '#12203A',
  navy700: '#1B2E4F',
  navy600: '#27406B',
  navy100: '#E7ECF4',
  navy050: '#F4F7FB',

  gold600: '#A8871F',
  gold500: '#C9A227',
  gold400: '#DCBB55',
  gold100: '#F7EFD6',

  teal700: '#0D6B60',
  teal600: '#0F9488',
  teal400: '#2DD4BF',
  teal100: '#CCFBF1',
  tealHeaderLight: '#0B3B36',
  tealHeaderDark: '#0F2E2A',

  white: '#FFFFFF',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',

  red600: '#B91C1C',
  red500: '#DC2626',
  red100: '#FEE2E2',
  amber600: '#B45309',
  amber500: '#D97706',
  amber100: '#FEF3C7',
  green600: '#15803D',
  green500: '#16A34A',
  green100: '#DCFCE7',
  blue600: '#1D4ED8',
  blue100: '#DBEAFE',
} as const;

export type Colors = {
  bg: string; surface: string; surfaceAlt: string;
  headerBg: string; headerText: string;
  text: string; textMuted: string; textFaint: string; border: string;
  accent: string; accentSoft: string; onAccent: string;
  danger: string; dangerSoft: string;
  warn: string; warnSoft: string;
  ok: string; okSoft: string;
  info: string; infoSoft: string;
};

const light: Colors = {
  bg: palette.navy050,
  surface: palette.white,
  surfaceAlt: palette.navy100,
  headerBg: palette.navy900,
  headerText: palette.white,
  text: palette.navy900,
  textMuted: palette.slate500,
  textFaint: palette.slate400,
  border: palette.slate200,
  accent: palette.gold600,
  accentSoft: palette.gold100,
  onAccent: palette.navy900,
  danger: palette.red600,
  dangerSoft: palette.red100,
  warn: palette.amber600,
  warnSoft: palette.amber100,
  ok: palette.green600,
  okSoft: palette.green100,
  info: palette.blue600,
  infoSoft: palette.blue100,
};

const dark: Colors = {
  bg: palette.navy900,
  surface: palette.navy800,
  surfaceAlt: palette.navy700,
  headerBg: palette.navy800,
  headerText: palette.white,
  text: palette.white,
  textMuted: palette.slate300,
  textFaint: palette.slate400,
  border: palette.navy600,
  accent: palette.gold400,
  accentSoft: 'rgba(201,162,39,0.18)',
  onAccent: palette.navy900,
  danger: '#F87171',
  dangerSoft: 'rgba(220,38,38,0.22)',
  warn: '#FBBF24',
  warnSoft: 'rgba(217,119,6,0.22)',
  ok: '#4ADE80',
  okSoft: 'rgba(22,163,74,0.22)',
  info: '#60A5FA',
  infoSoft: 'rgba(29,78,216,0.25)',
};

/**
 * Temizlik modulu icin lacivert-altin'in teal (soft yesil) karsiligi.
 * SADECE accent/accentSoft/onAccent/headerBg degisir — geri kalan tum
 * yapisal token'lar (bg/surface/border/danger/ok vb.) AYNI kalir ki
 * "temizlik hissi" bir marka vurgusu olarak eklensin, ayri bir tema
 * sistemi olusturmasin.
 */
const lightCleaning: Colors = {
  ...light,
  headerBg: palette.tealHeaderLight,
  accent: palette.teal600,
  accentSoft: palette.teal100,
  onAccent: palette.white,
};

const darkCleaning: Colors = {
  ...dark,
  headerBg: palette.tealHeaderDark,
  accent: palette.teal400,
  accentSoft: 'rgba(45,212,191,0.18)',
  onAccent: palette.teal700,
};

/** Modul secim ekrani gibi tek bir modulle sinirli olmayan yerlerde kart/rozet vurgusu icin */
export const moduleAccent: Record<ModuleType, { light: string; dark: string; lightSoft: string; darkSoft: string }> = {
  elevator: { light: light.accent, dark: dark.accent, lightSoft: light.accentSoft, darkSoft: dark.accentSoft },
  cleaning: { light: lightCleaning.accent, dark: darkCleaning.accent, lightSoft: lightCleaning.accentSoft, darkSoft: darkCleaning.accentSoft },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const font = {
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 19, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
  money: { fontSize: 16, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
  moneySm: { fontSize: 13, fontWeight: '600' as const, fontVariant: ['tabular-nums'] as const },
  moneyLg: { fontSize: 26, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
  moneyMd: { fontSize: 20, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
};

/**
 * Bir ekran agacinin hangi modulun renklerini kullanacagini belirler.
 * [module]/index.tsx kendi altindaki her seyi (QuickEntryModal,
 * EditSiteModal, AddSiteModal, liste kartlari...) bu Provider ile sarar;
 * icerideki tum useTheme() cagrilari HICBIR PROP GECMEDEN dogru rengi
 * otomatik alir. Modul secimi disindaki ekranlar (login, modul secim
 * ekrani) sarilmadigi icin varsayilan lacivert-altin'da kalir.
 */
const ModuleThemeContext = createContext<ModuleType | null>(null);

export function ModuleThemeProvider({ module, children }: { module: ModuleType; children: React.ReactNode }) {
  return React.createElement(ModuleThemeContext.Provider, { value: module }, children);
}

/** `module` verilirse context'i ezer — ekranin kendisi Provider'i sarmadan ONCE kendi rengini bilmek icin kullanir */
export function useTheme(module?: ModuleType) {
  const scheme = useColorScheme();
  const ctxModule = useContext(ModuleThemeContext);
  const activeModule = module ?? ctxModule;
  const isDark = scheme === 'dark';
  const c = activeModule === 'cleaning' ? (isDark ? darkCleaning : lightCleaning) : (isDark ? dark : light);
  return { c, dark: isDark, spacing, radius, font };
}

/** Bilanco durumlarinin renk esleri (v_ledger.status_key ile birebir) */
export function statusColors(c: Colors, key: string) {
  switch (key) {
    case 'completed':       return { fg: c.ok,     bg: c.okSoft };
    case 'overdue':         return { fg: c.danger, bg: c.dangerSoft };
    case 'overdue_partial': return { fg: c.danger, bg: c.dangerSoft };
    case 'partial':         return { fg: c.warn,   bg: c.warnSoft };
    case 'overpaid':        return { fg: c.info,   bg: c.infoSoft };
    default:                return { fg: c.textMuted, bg: c.surfaceAlt };
  }
}
