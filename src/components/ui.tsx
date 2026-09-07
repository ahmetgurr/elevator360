import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle, useWindowDimensions,
} from 'react-native';
import { glassColors, useTheme } from '@/lib/theme';
import { GlassCard, GlassSurface, ModalBackdrop } from './Glass';

/**
 * Yıkıcı/kritik işlemler (hesaptan çıkış, veri silme) için tek satırlık
 * onay — yanlışlıkla dokunmaya karşı (bkz. kullanıcı geri bildirimi).
 * Native'de gerçek Alert.alert kullanılır; react-native-web'in Alert.alert'ı
 * SESSİZCE HİÇBİR ŞEY YAPMAYAN bir stub olduğu için (callback hiç
 * çağrılmaz — web'de "Çıkış" tuşu tamamen ölü görünürdü), web'de
 * window.confirm'e düşer.
 */
export function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/* --------------------------------- Metin -------------------------------- */

type TxtProps = {
  children: React.ReactNode;
  variant?: keyof ReturnType<typeof useTheme>['font'];
  color?: string;
  style?: any;
  numberOfLines?: number;
};

export function Txt({ children, variant = 'body', color, style, numberOfLines }: TxtProps) {
  const { c, font } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[font[variant], { color: color ?? c.text }, style]}>
      {children}
    </Text>
  );
}

/* --------------------------------- Kart --------------------------------- */

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <GlassCard contentStyle={style}>{children}</GlassCard>;
}

/* -------------------------------- Buton --------------------------------- */

type BtnProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: BtnProps) {
  const { c, radius, spacing, font } = useTheme();
  const bg =
    variant === 'primary'   ? c.accent :
    variant === 'danger'    ? c.danger :
    variant === 'secondary' ? glassColors.cardBg : 'transparent';
  const fg =
    variant === 'primary' ? c.onAccent :
    variant === 'danger'  ? '#FFFFFF' :
    variant === 'ghost'   ? c.accent : glassColors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{
        backgroundColor: bg,
        borderRadius: radius.md,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        borderWidth: variant === 'ghost' || variant === 'secondary' ? 1 : 0,
        borderColor: glassColors.cardBorder,
      }, style]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? c.onAccent : c.accent} />
        : <Text style={[font.h3, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

/* ------------------------------ Metin alani ----------------------------- */

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string };

export function Field({ label, hint, error, style, ...rest }: FieldProps) {
  const { c, radius, spacing, font } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[font.small, { color: glassColors.textSecondary, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        placeholderTextColor={glassColors.textSecondary}
        style={[{
          backgroundColor: glassColors.inputBg,
          borderWidth: 1,
          borderColor: error ? c.danger : glassColors.inputBorder,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: 16,
          color: glassColors.textPrimary,
        }, style]}
        {...rest}
      />
      {!!error && <Text style={[font.small, { color: c.danger }]}>{error}</Text>}
      {!error && !!hint && <Text style={[font.small, { color: glassColors.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

/* ------------------------------- Durumlar ------------------------------- */

export function Loading({ label }: { label?: string }) {
  const { c, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <ActivityIndicator color={c.accent} size="large" />
      {!!label && <Txt variant="small" color={c.textMuted}>{label}</Txt>}
    </View>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  const { c, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Txt variant="h3" color={c.textMuted}>{title}</Txt>
      {!!detail && (
        <Txt variant="small" color={c.textFaint} style={{ textAlign: 'center' }}>{detail}</Txt>
      )}
    </View>
  );
}

/* --------------------------------- Toast --------------------------------- */

type ToastVariant = 'success' | 'error';

export function Toast({ visible, message, variant = 'success', onHide }: {
  visible: boolean; message: string; variant?: ToastVariant; onHide: () => void;
}) {
  const { c, spacing, radius, font } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(onHide);
    }, 2400);
    return () => clearTimeout(timer);
  }, [visible, message]);

  if (!visible) return null;

  const bg = variant === 'success' ? c.ok : c.danger;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xl,
        backgroundColor: bg, borderRadius: radius.md,
        paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        opacity,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Text style={[font.h3, { color: '#FFFFFF' }]}>{variant === 'success' ? '✓' : '!'}</Text>
      <Text style={[font.body, { color: '#FFFFFF', flex: 1 }]}>{message}</Text>
    </Animated.View>
  );
}

/* ------------------------------ Modal kabuğu ------------------------------ */

/**
 * Kaydırılabilir icerikli TUM modallarin ortak govdesi. "Dışına dokunarak
 * kapatma" backdrop'ı, içerik kutusunun bir Pressable ÇOCUĞU DEĞİL, aynı
 * katmandaki AYRI bir sibling olarak durur (pointerEvents="box-none" ile
 * içerik dışındaki boş alanlardan backdrop'a "sızması" sağlanır). Böylece
 * içerik kutusundaki ScrollView, dokunma/kaydırma responder'ını hiçbir üst
 * Pressable ile paylaşmak zorunda kalmaz.
 *
 * Bu, kullanıcı geri bildirimindeki "normal hızda kaydırma donuk kalıyor,
 * sadece sert/hızlı kaydırınca tepki veriyor" sorununun kök nedeniydi:
 * eski yapıda ScrollView bir Pressable'ın (içerik kutusu) doğrudan çocuğuydu;
 * Pressable, dokunuşun "tık mı yoksa kaydırma mı" olduğuna yavaş/küçük
 * hareketlerde geç karar veriyor, bu da ScrollView'ın responder'ı hemen
 * devralmasını engelliyordu. Yalnızca hızlı/büyük hareketler eşiği hemen
 * aşıp Pressable'ı erken serbest bıraktığı için "sert kaydırma çalışıyor"
 * gibi görünüyordu.
 */
export function ModalShell({ visible, onClose, keyboardAvoiding, maxHeightRatio = 0.85, children }: {
  visible: boolean;
  onClose: () => void;
  /** iOS'ta klavye açıldığında içeriğin yukarı kayması gerekiyorsa */
  keyboardAvoiding?: boolean;
  /** İçerik kutusunun ekran yüksekliğinin yüzde kaçını aşamayacağı (Android'de yüzdesel maxHeight güvenilir çözümlenmeyebiliyor — bkz. kullanıcı geri bildirimi; bu yüzden sabit piksele çevrilir) */
  maxHeightRatio?: number;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const Wrapper: any = keyboardAvoiding ? KeyboardAvoidingView : View;
  const wrapperProps = keyboardAvoiding
    ? { behavior: Platform.OS === 'ios' ? ('padding' as const) : undefined, style: { flex: 1 } }
    : { style: { flex: 1 } };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Wrapper {...wrapperProps}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
          <ModalBackdrop />
        </Pressable>
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <GlassSurface style={{ maxHeight: windowHeight * maxHeightRatio, flexShrink: 1 }}>
            {children}
          </GlassSurface>
        </View>
      </Wrapper>
    </Modal>
  );
}

/* ------------------------------ Onay penceresi --------------------------- */

export function ConfirmModal({
  visible, title, message, confirmLabel = 'Onayla', cancelLabel = 'Vazgeç',
  danger, loading, onConfirm, onCancel,
}: {
  visible: boolean; title: string; message?: string;
  confirmLabel?: string; cancelLabel?: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', padding: spacing.xl }]}
      >
        <ModalBackdrop />
        <Pressable onPress={e => e.stopPropagation()}>
          <GlassSurface style={{ padding: spacing.lg, gap: spacing.md }}>
            <Txt variant="h3" color={glassColors.textPrimary}>{title}</Txt>
            {!!message && <Txt variant="small" color={glassColors.textSecondary}>{message}</Txt>}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <Button title={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
              <Button title={confirmLabel} variant={danger ? 'danger' : 'primary'}
                      onPress={onConfirm} loading={loading} style={{ flex: 1 }} />
            </View>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c, spacing } = useTheme();
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Txt variant="h3" color={c.danger}>Bir sorun oluştu</Txt>
        <Txt variant="small" color={glassColors.textSecondary}>{message}</Txt>
        {!!onRetry && <Button title="Tekrar dene" variant="secondary" onPress={onRetry} />}
      </Card>
    </View>
  );
}
