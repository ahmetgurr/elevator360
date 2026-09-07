/**
 * Elevator360 tasarim sistemi.
 * Koyu lacivert + altin kimlik (Asansör). Temizlik modulu, kullanicinin
 * yanlis module veri girmesini engellemek icin AYRI bir vurgu renginde
 * (soft teal/yesil) calisir — bkz. ModuleThemeProvider. Tum renkler token
 * uzerinden kullanilir; bilesenlerde ham hex yazilmaz.
 */
import React, { createContext, useContext } from 'react';
import type { ModuleType } from './types';

const palette = {
  navy900: '#0B1526',
  navy800: '#12203A',
  navy700: '#1B2E4F',
  navy600: '#27406B',
  navy100: '#E7ECF4',
  navy050: '#F4F7FB',

  // Elevator modulunun kimlik rengi. Onceki "Soft Gold" (#C9A96E) hala
  // sicak/sarimsi okunuyordu (bkz. kullanici geri bildirimi: uygulamada
  // kalan TUM turuncu/sari tonlarin kaldirilmasi istendi) — Buzlu Mavi'ye
  // cekildi; Temizlik modulunun Turkuaz'iyla birlikte iki net, "yapay zeka
  // sarisi" icermeyen marka rengi cifti olusturur.
  icyBlue600: '#2C5AA0',
  icyBlue100: '#DCEAFD',

  // "Eksik/Kismi" durumu icin: amber/turuncu yerine notr, soft bordo (bkz.
  // kullanici geri bildirimi — "cok sirtamayan, estetik bir uyari rengi").
  bordo600: '#7A3A41',
  bordo100: '#F3E0E2',

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
  accent: palette.icyBlue600,
  accentSoft: palette.icyBlue100,
  onAccent: palette.white,
  danger: palette.red600,
  dangerSoft: palette.red100,
  warn: palette.bordo600,
  warnSoft: palette.bordo100,
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
  accent: '#60A5FA',
  accentSoft: 'rgba(96,165,250,0.18)',
  onAccent: palette.white,
  // Pastel mint/soluk kirmizi yerine tok, "finansal" kirmizi/yesil (bkz.
  // kullanici geri bildirimi — bankacilik uygulamalarindaki gibi canli
  // olsun istendi).
  danger: '#E53935',
  dangerSoft: 'rgba(229,57,53,0.22)',
  // Amber/turuncu yerine notr soft bordo (bkz. kullanici geri bildirimi).
  warn: '#C2707A',
  warnSoft: 'rgba(194,112,122,0.22)',
  ok: '#00C853',
  okSoft: 'rgba(0,200,83,0.20)',
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
/**
 * Uygulama artik her ekranda buzlu cam / fotografli arka plan kullaniyor
 * (bkz. GlassBackground, kok layout'a tek sefer monte edilir). Bu yuzden
 * c.* token'lari ARTIK sistem acik/koyu temasini degil, HER ZAMAN koyu
 * paleti dondurur — aksi halde acik sistem temasinda koyu metin/opak beyaz
 * yuzeyler fotografin uzerinde okunmaz hale gelirdi.
 */
export function useTheme(module?: ModuleType) {
  const ctxModule = useContext(ModuleThemeContext);
  const activeModule = module ?? ctxModule;
  const isDark = true;
  const c = activeModule === 'cleaning' ? darkCleaning : dark;
  return { c, dark: isDark, spacing, radius, font };
}

/**
 * Glassmorphism (Buzlu Cam) tasarim dili — SADECE Ana Ekran (Dashboard) ve
 * giris ekraninda kullanilir. Sistem acik/koyu temasindan BAGIMSIZ, sabit
 * bir palettir (arka plan her zaman fotografli/koyu oldugu icin acik temada
 * bile beyaza yakin metin gerekir) — bu yuzden light/dark Colors sisteminden
 * ayri tutulur.
 */
export const glassColors = {
  primary: '#2563EB',
  primaryLight: '#60A5FA',
  // Pastel mint yerine tok/canli finansal yesil-kirmizi (bkz. Colors.ok/danger
  // yorumu) — Dashboard/Genel Kasa Ozeti gibi glassColors kullanan ekranlarda
  // ayni kimlik icin birebir eslenir.
  accent: '#00A344',
  accentLight: '#00C853',
  danger: '#E53935',
  // Amber/turuncu yerine notr soft bordo (bkz. kullanici geri bildirimi:
  // "Eksik" yazisinin turuncu rengi cok sirtiyordu).
  warning: '#C2707A',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.15)',
  cardBgSoft: 'rgba(255,255,255,0.07)',
  inputBg: 'rgba(255,255,255,0.12)',
  inputBorder: 'rgba(255,255,255,0.20)',
  /** Modallarin KENDI govdesi icin: beyaz tonlu cardBg "gri/soluk" duruyordu
   * (bkz. kullanici geri bildirimi). Lacivert kimlige (navy900) uyumlu, daha
   * opak bir dolgu — modal zaten koyu+bulanik bir ModalBackdrop'un ustunde
   * durdugu icin bu opakligi kaldirabilir, metin okunurlugu ARTAR. */
  modalCardBg: 'rgba(11,21,38,0.82)',
  modalCardBorder: 'rgba(255,255,255,0.14)',
  /** Blursuz ogeler icin (liste satirlari, dip kutular): keskin fotografin
   * uzerinde metin okunurlugu icin daha koyu, dogrudan (blursuz) saydamlik. */
  rowBg: 'rgba(5,15,30,0.55)',
  rowBgPressed: 'rgba(5,15,30,0.68)',
  scrimDark: 'rgba(5,20,40,0.58)',
  scrimBlue: 'rgba(37,99,235,0.08)',
  trackBg: 'rgba(255,255,255,0.20)',
  /** Modal/popup arka planlarindaki koyu perde — altindaki liste/ekran
   * metniyle modalin kendi icerigi birbirine girmesin diye NEREDEYSE opak
   * (bkz. kullanici geri bildirimi: "arkadaki yazilarla modal ici yazilar
   * birbirine giriyor", iki modal ust uste acildiginda daha da kotu). */
  modalScrim: 'rgba(5,10,25,0.97)',
} as const;

/** Buyuk rakamlarin (Toplam Beklenen, Kalan Alacak vb.) fotografli arka planda okunurlugunu artiran hafif metin golgesi. */
export const glassTextShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

export const glassGradients = {
  primary: ['#60A5FA', '#2563EB'] as const,
  positive: ['#00E676', '#00A344'] as const,
};

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
