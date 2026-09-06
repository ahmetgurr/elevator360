import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { useTheme } from '@/lib/theme';

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
  const { c, radius, spacing } = useTheme();
  return (
    <View style={[{
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    }, style]}>
      {children}
    </View>
  );
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
    variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg =
    variant === 'primary' ? c.onAccent :
    variant === 'danger'  ? '#FFFFFF' :
    variant === 'ghost'   ? c.accent : c.text;

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
        borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
        borderColor: c.border,
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
      <Text style={[font.small, { color: c.textMuted, fontWeight: '600' }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textFaint}
        style={[{
          backgroundColor: c.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error ? c.danger : c.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: 16,
          color: c.text,
        }, style]}
        {...rest}
      />
      {!!error && <Text style={[font.small, { color: c.danger }]}>{error}</Text>}
      {!error && !!hint && <Text style={[font.small, { color: c.textFaint }]}>{hint}</Text>}
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

/* ------------------------------ Onay penceresi --------------------------- */

export function ConfirmModal({
  visible, title, message, confirmLabel = 'Onayla', cancelLabel = 'Vazgeç',
  danger, loading, onConfirm, onCancel,
}: {
  visible: boolean; title: string; message?: string;
  confirmLabel?: string; cancelLabel?: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { c, spacing, radius } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}
        >
          <Txt variant="h3">{title}</Txt>
          {!!message && <Txt variant="small" color={c.textMuted}>{message}</Txt>}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
            <Button title={confirmLabel} variant={danger ? 'danger' : 'primary'}
                    onPress={onConfirm} loading={loading} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c, spacing } = useTheme();
  return (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      <Card style={{ borderColor: c.danger, gap: spacing.sm }}>
        <Txt variant="h3" color={c.danger}>Bir sorun oluştu</Txt>
        <Txt variant="small" color={c.textMuted}>{message}</Txt>
        {!!onRetry && <Button title="Tekrar dene" variant="secondary" onPress={onRetry} />}
      </Card>
    </View>
  );
}
