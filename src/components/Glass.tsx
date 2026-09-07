import React, { createContext, useContext, useRef } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView, BlurTargetView, type BlurMethod } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glassColors, glassGradients } from '@/lib/theme';

const wallpaperWeb = require('../../assets/images/elevator360_liquid_wallpaper_1920x1080.jpg');
const wallpaperMobile = require('../../assets/images/elevator360_liquid_wallpaper_1080x2400.jpg');

/**
 * expo-blur, Android'de VARSAYILAN olarak gercek blur uygulamaz — resmi
 * dokumantasyonu bunu acikca soyluyor: "This package only supports iOS.
 * On Android, a plain View with a translucent background will be
 * rendered." (bkz. node_modules/expo-blur/README.md). Bu da Android'de
 * fotograf hic bulanmadigi icin kartin kenarligi+tonu, iOS'taki yumusak
 * "buzlu cam" yerine sert/net bir "beyaz cerceve" gibi gorunmesine yol
 * aciyordu (bkz. kullanici geri bildirimi — sadece Android'de, iPhone'da
 * sorun yok).
 *
 * Cozum: expo-blur'un YENI, Android'e ozel "blurTarget" API'si. Gercek
 * blur icin BlurView'e, hangi View'i bulaniklastiracagini gosteren bir
 * BlurTargetView referansi verilmesi gerekiyor (blurMethod=
 * "dimezisBlurViewSdk31Plus" — SDK 31 ustunde gercek blur, altinda
 * otomatik+guvenli sekilde "none"a duser, cokme riski yok). Bu context,
 * GlassBackground'in fotografini saran BlurTargetView referansini asagi
 * (GlassCard'lara) tasir — SADECE ana ekran akisindaki kartlar icin
 * kullanilir (bkz. GlassCard). Modallar (`<Modal>`) ayri bir native
 * pencerede sunuldugu icin bu hedefe erisemez; onlar icin blurTarget
 * BILEREK kullanilmiyor (bkz. GlassSurface/ModalBackdrop — orada blur
 * yerine daha koyu bir rgba perde okunurlugu garanti ediyor).
 */
const BlurTargetContext = createContext<React.RefObject<View | null> | null>(null);

/**
 * Uygulamanin ortak arka plan mimarisi: manzara fotografi + koyulastirici
 * katman + mavi atmosfer katmani. _layout.tsx'te KOK seviyede bir kez, AYRICA
 * her ekranin kendi govdesinde tekrar monte edilir. Native'de (Expo Go) her
 * ekran ayri bir native katman olarak animasyonla kaydirildigi icin, TEK bir
 * paylasilan (kok) arka plan yeterli degildi — iki ekran da seffaf oldugunda
 * gecis sirasinda birbirinin icinden gorunup "ust uste biniyor"du (bkz.
 * kullanici geri bildirimi). Her ekran kendi fotografini tasidiginda native
 * katman kendi icinde opak/tamamlanmis olur, sizinti kalmaz. Ayni goruntu
 * kullanildigi icin web'de (tek DOM agaci) fark edilmez.
 * `safeArea=false` verildiginde SafeAreaView atlanir — Stack/header zaten
 * kendi guvenli alanini yonetir (bkz. [module]/index.tsx, kok layout).
 *
 * Fotograf + iki koyulastirici katman, Android'de gercek blur'un
 * "gorebilmesi" icin bir BlurTargetView ICINE alinir (bkz. yukaridaki
 * BlurTargetContext notu). ImageBackground yerine dogrudan Image
 * kullanilir ki fotograf piksellerinin KENDISI de bu hedefin ICINDE olsun
 * (ImageBackground kullansaydik, gercek <Image> ImageBackground'in kendi
 * ic implementasyonunda AYRI bir sibling olurdu ve hedefin disinda kalirdi
 * — blur o zaman sadece renk katmanlarini bulandirir, fotografi degil).
 */
export function GlassBackground({ children, style, safeArea = true }: {
  children: React.ReactNode; style?: ViewStyle; safeArea?: boolean;
}) {
  const source = Platform.OS === 'web' ? wallpaperWeb : wallpaperMobile;
  const targetRef = useRef<View>(null);
  const content = safeArea ? <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView> : children;
  return (
    <View style={[{ flex: 1 }, style]}>
      <BlurTargetView ref={targetRef} collapsable={false} style={StyleSheet.absoluteFill}>
        <Image
          source={source}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassColors.scrimDark }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassColors.scrimBlue }]} />
      </BlurTargetView>
      <BlurTargetContext.Provider value={targetRef}>
        {content}
      </BlurTargetContext.Provider>
    </View>
  );
}

/** Android'de gercek blur icin: SDK 31+ gercek Dimezis blur, altinda otomatik "none"a duser. */
const ANDROID_BLUR_METHOD: BlurMethod = 'dimezisBlurViewSdk31Plus';

/**
 * Ham buzlu cam yuzeyi. BlurView ARTIK children'i SARMALAMAZ — bunun yerine
 * kapsayicinin icinde StyleSheet.absoluteFill ile sabitlenmis, ICI BOS bir
 * arka plan katmani olarak durur; asil icerik (children) onun YANINDA
 * (siblinginda), normal akista render edilir ve blur'un UZERINDE gorunur.
 *
 *   outerBorder (duz View — borderRadius, borderWidth, overflow:hidden,
 *     backgroundColor:'transparent' — TEK kenarlik kaynagi burasi)
 *   > BlurView (absoluteFill, ICINDE HICBIR SEY YOK — sadece intensity +
 *     backgroundColor, kendi kenarligi/radius'u/dolgusu YOK)
 *   > children (normal akista sibling — kutunun boyutunu BU belirler,
 *     BlurView'in kendisi absolute oldugu icin boyuta katkida bulunmaz)
 *
 * Neden bu sekilde: BlurView children'i SARDIGINDA (eski mimari), native'de
 * (Android/Expo Go) BlurView'in kendi native render katmani icerideki
 * View'lara -kenarlik/radius/dolgu BlurView'in USTUNDE olmasa bile- görünür
 * bir sinir/kutu kazandiriyordu ("kutu icinde kutu" — bkz. kullanici geri
 * bildirimi, ekran goruntuleriyle dogrulandi). BlurView'i icerikten tamamen
 * ayirip SADECE bir arkaplan katmani haline getirmek (children'i SARMAYAN,
 * gorunmez/ic-boyutsuz bir dekor) bu native'e ozgu sarmalama artefaktini
 * kokten ortadan kaldirir. Web'de zaten CSS backdrop-filter oldugu icin bu
 * fark hic yoktu.
 */
export function GlassSurface({ children, style, intensity = 20, fill, blurTarget, blurMethod, tintColor, borderColor }: {
  children: React.ReactNode; style?: ViewStyle; intensity?: number;
  /** GlassCard gibi flex:1 ile ustten yukseklik dayatilan baglamlarda kullanilir. */
  fill?: boolean;
  /** Android'de gercek blur icin — bkz. GlassBackground/BlurTargetContext. Modallarda BILEREK verilmez. */
  blurTarget?: React.RefObject<View | null>;
  blurMethod?: BlurMethod;
  /** Varsayilan (beyaz tonlu, fotografli ekranlar icin) cardBg/cardBorder'i ezer — bkz. modalCardBg. */
  tintColor?: string;
  borderColor?: string;
}) {
  return (
    <View style={[styles.outerBorder, borderColor != null && { borderColor }, fill && styles.fill, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        pointerEvents="none"
        blurTarget={blurTarget ?? undefined}
        blurMethod={blurMethod}
        style={[StyleSheet.absoluteFill, styles.blurBg, tintColor != null && { backgroundColor: tintColor }]}
      />
      {children}
    </View>
  );
}

/**
 * Buzlu cam kart: GlassSurface + golge + kesin (ezilemeyen) ic dolgu.
 *   shadowWrap (golge, KIRPMASIZ — golge kirpilirse gorunmez olur)
 *   > GlassSurface (kenarlik+kirpma katmani + blur katmani — Android'de
 *     GlassBackground'in blurTarget'ini kullanarak GERCEK blur uygular)
 *   > content (padding: 24, backgroundColor: 'transparent' — contentStyle
 *     ile ASLA ezilmez; contentStyle yalnizca gap/minHeight/justifyContent
 *     gibi duzen ozellikleri icindir, arkaplan/kenarlik ASLA icermemeli)
 */
export function GlassCard({ children, style, contentStyle, intensity = 30 }: {
  children: React.ReactNode; style?: ViewStyle; contentStyle?: ViewStyle; intensity?: number;
}) {
  const blurTarget = useContext(BlurTargetContext);
  return (
    <View style={[styles.shadowWrap, style]}>
      <GlassSurface
        intensity={intensity}
        fill
        blurTarget={blurTarget ?? undefined}
        blurMethod={blurTarget ? ANDROID_BLUR_METHOD : undefined}
      >
        <View style={[styles.content, contentStyle, styles.contentPaddingLock]}>{children}</View>
      </GlassSurface>
    </View>
  );
}

const CARD_RADIUS = 24;
const CARD_PADDING = 24;

const styles = StyleSheet.create({
  // En dis katman: SADECE golge. borderWidth/overflow YOK — overflow:'hidden'
  // burada olsaydi golgeyi de kirpardi (golge kendi kutusunun disina tasarak
  // cizilir).
  shadowWrap: {
    borderRadius: CARD_RADIUS,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  fill: {
    flex: 1,
  },
  // "En Dis Kapsayici": duz View — kenarlik + kirpma + boyut BURADA. TEK
  // kenarlik kaynagi budur.
  outerBorder: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: glassColors.cardBorder,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  // "Arka Plan Katmani": BlurView, absoluteFill ile sabit — SADECE intensity
  // (prop) + arkaplan. Kenarlik/radius/dolgu YOK, icinde HICBIR SEY yok.
  blurBg: {
    backgroundColor: glassColors.cardBg,
  },
  // "En Ic": SADECE padding + seffaf arkaplan.
  content: {
    flex: 1,
    padding: CARD_PADDING,
    backgroundColor: 'transparent',
  },
  // contentStyle ile birlikte en son uygulanir; padding'i her zaman geri
  // kilitler (contentStyle yanlislikla padding gecerse bile) — icerideki
  // HICBIR bilesen dis cerceveye 24px'den fazla yaklasamaz.
  contentPaddingLock: {
    padding: CARD_PADDING,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});

/**
 * Modal arka planindaki bulanik + koyu perde katmani. pointerEvents="none"
 * ile kendisi dokunma olayi yakalamaz — kapatma davranisini backdrop olarak
 * kullanildigi Pressable ustlenir, bu sadece GORSEL katmandir. Sadece rgba
 * renk yerine gercek BlurView kullanilir ki arkadaki liste/ekran yazilari
 * SEÇILEMEZ/OKUNAMAZ hale gelsin (bkz. kullanici geri bildirimi: "arkadaki
 * yazilar hala okunabiliyor"). StyleSheet.absoluteFillObject ile ekranin
 * dort kenarina da (top/left/right/bottom: 0) sabitlenir — Modal'in kendi
 * govdesi tam ekrani kaplamadiginda bile (bkz. Android nav bar seridi
 * sorunu) bu katman hicbir bosluk birakmaz.
 */
export function ModalBackdrop() {
  return (
    <BlurView
      intensity={65}
      tint="dark"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: glassColors.modalScrim }]}
    />
  );
}

type GradientButtonProps = {
  title: string;
  onPress: () => void;
  icon?: string;
  chevron?: boolean;
  variant?: 'primary' | 'positive';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

/** Gradyanli buton (~135deg). Primary/pozitif iki varyant. */
export function GradientButton({ title, onPress, icon, chevron = true, variant = 'primary', disabled, loading, style }: GradientButtonProps) {
  const colors = variant === 'positive' ? glassGradients.positive : glassGradients.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ borderRadius: 14, overflow: 'hidden', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles2.gradient}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {!!icon && <Text style={styles2.icon}>{icon}</Text>}
            <Text style={styles2.label}>{title}</Text>
            {chevron && <Text style={styles2.chevron}>›</Text>}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles2 = StyleSheet.create({
  gradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  icon: { fontSize: 16 },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  chevron: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

/** Gradyanli ilerleme cubugu. tier'e gore renk degisir (iyi/orta/dusuk tahsilat). */
export function GlassProgressBar({ value, tier = 'positive' }: { value: number; tier?: 'positive' | 'primary' | 'danger' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: glassColors.trackBg, overflow: 'hidden' }}>
      {tier === 'danger' ? (
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: glassColors.danger }} />
      ) : (
        <LinearGradient
          colors={tier === 'primary' ? glassGradients.primary : glassGradients.positive}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: `${pct}%`, height: '100%' }}
        />
      )}
    </View>
  );
}
