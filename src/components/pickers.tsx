import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { glassColors, useTheme } from '@/lib/theme';
import { periodLabel, shiftPeriod, currentPeriod } from '@/lib/format';
import { Button, Txt } from './ui';
import { GlassSurface, ModalBackdrop } from './Glass';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

/* ---------------------------------- Arama --------------------------------- */

export function SearchBar({ value, onChange, placeholder = 'Site adı ara…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const { spacing, radius, font } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: glassColors.inputBg, borderRadius: radius.md,
      borderWidth: 1, borderColor: glassColors.inputBorder,
      paddingHorizontal: spacing.md,
    }}>
      <Txt variant="body" color={glassColors.textSecondary}>🔍</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={glassColors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={100}
        style={[font.body, { flex: 1, color: glassColors.textPrimary, paddingVertical: spacing.md }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <Txt variant="h3" color={glassColors.textSecondary}>✕</Txt>
        </Pressable>
      )}
    </View>
  );
}

/* --------------------------- Durum filtresi ----------------------------- */
/** Varsayilan "Tumunu Sec"; secim aninda liste filtrelenir. */

export function FilterDropdown<T extends string>({
  value, options, onChange, counts, compact, title = 'Duruma göre filtrele',
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
  /** "+ Ekle" ile ayni boyutta kompakt bir pil tetikleyici — or. Sırala menusu */
  compact?: { icon: string; label: string };
  /** Modal basligi (varsayilan: durum filtresi metni) */
  title?: string;
}) {
  const { c, spacing, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.key === value) ?? options[0];

  return (
    <>
      {compact ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            backgroundColor: glassColors.cardBg,
            borderWidth: 1, borderColor: glassColors.cardBorder,
            borderRadius: radius.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Txt variant="small" color={glassColors.textPrimary} numberOfLines={1} style={{ fontWeight: '700' }}>{compact.icon} {compact.label}</Txt>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
            backgroundColor: pressed ? glassColors.cardBgSoft : glassColors.cardBg,
            borderWidth: 1, borderColor: glassColors.cardBorder,
            borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
          })}
        >
          <Txt variant="small" color={glassColors.textPrimary} style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{current.label}</Txt>
          <Txt variant="tiny" color={glassColors.textSecondary} numberOfLines={1} style={{ flexShrink: 0 }}>
            {counts?.[value] !== undefined ? `${counts[value]} site  ▾` : '▾'}
          </Txt>
        </Pressable>
      )}

      <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={[StyleSheet.absoluteFill, { justifyContent: 'center', padding: spacing.xl }]}
        >
          <ModalBackdrop />
          <Pressable onPress={e => e.stopPropagation()}>
            <GlassSurface intensity={30} tintColor={glassColors.modalCardBg} borderColor={glassColors.modalCardBorder}>
              <View style={{ padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: glassColors.cardBorder }}>
                <Txt variant="h3" color={glassColors.textPrimary}>{title}</Txt>
              </View>
              <ScrollView style={{ maxHeight: 380 }}>
                {options.map(opt => {
                  const active = opt.key === value;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => { onChange(opt.key); setOpen(false); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
                        backgroundColor: active ? c.accentSoft : pressed ? glassColors.cardBgSoft : 'transparent',
                      })}
                    >
                      <Txt variant="body" color={active ? c.accent : glassColors.textPrimary}
                           style={{ fontWeight: active ? '700' : '400' }}>
                        {opt.label}
                      </Txt>
                      <Txt variant="small" color={glassColors.textSecondary}>
                        {counts?.[opt.key] !== undefined ? String(counts[opt.key]) : ''}
                      </Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </GlassSurface>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ----------------------------- Donem secici ----------------------------- */

export function PeriodSwitcher({ period, onChange, compact }: {
  period: string; onChange: (p: string) => void;
  /** Dashboard'daki "Genel Kasa Özeti" gibi dar baslik satirlarinda kullanilan daha kucuk varyant. */
  compact?: boolean;
}) {
  const { spacing, radius } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between',
      alignSelf: compact ? 'flex-start' : 'stretch',
      backgroundColor: glassColors.cardBg, borderRadius: radius.md,
      borderWidth: 1, borderColor: glassColors.cardBorder,
      paddingHorizontal: 2, paddingVertical: 2,
    }}>
      <Arrow label="‹" compact onPress={() => onChange(shiftPeriod(period, -1))} />
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.xs, paddingHorizontal: 2, flexShrink: 1 }}
      >
        <Txt variant={compact ? 'tiny' : 'small'} color={glassColors.textPrimary} numberOfLines={1} style={{ fontWeight: '700' }}>
          {periodLabel(period)}
        </Txt>
        <Txt variant="tiny" color={glassColors.textSecondary}>▾</Txt>
      </Pressable>
      <Arrow label="›" compact onPress={() => onChange(shiftPeriod(period, 1))} />

      <MonthYearPickerModal
        visible={pickerOpen}
        period={period}
        onClose={() => setPickerOpen(false)}
        onSelect={p => { onChange(p); setPickerOpen(false); }}
      />
    </View>
  );
}

/* ----------------------------- Ay / yıl seçici --------------------------- */

function MonthYearPickerModal({ visible, period, onClose, onSelect }: {
  visible: boolean; period: string; onClose: () => void; onSelect: (period: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const [y] = period.split('-').map(Number);
  const [year, setYear] = useState(y);
  const nowPeriod = currentPeriod();

  // Modal her acildiginda goruntulenen yil, secili donemin yilina sifirlanir
  useEffect(() => { if (visible) setYear(y); }, [visible, y]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', padding: spacing.xl }]}
      >
        <ModalBackdrop />
        <Pressable onPress={e => e.stopPropagation()}>
          <GlassSurface>
            <View style={{ padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: glassColors.cardBorder }}>
              <Txt variant="h3" color={glassColors.textPrimary}>Ay / Yıl Seç</Txt>
            </View>

            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
                <Arrow label="‹" onPress={() => setYear(v => v - 1)} />
                <Txt variant="h2" color={glassColors.textPrimary}>{year}</Txt>
                <Arrow label="›" onPress={() => setYear(v => v + 1)} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
                {MONTHS.map((label, idx) => {
                  const monthNum = idx + 1;
                  const candidate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
                  const active = candidate === period;
                  const isNow = candidate === nowPeriod;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => onSelect(candidate)}
                      style={({ pressed }) => ({
                        width: '30%',
                        paddingVertical: spacing.sm + 2,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        backgroundColor: active ? c.accent : pressed ? glassColors.cardBgSoft : glassColors.cardBg,
                        borderWidth: isNow && !active ? 1 : 0,
                        borderColor: c.accent,
                      })}
                    >
                      <Txt variant="small" color={active ? c.onAccent : glassColors.textPrimary}
                           style={{ fontWeight: active ? '700' : '400' }}>
                        {label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>

              <Button title="Bu Aya Dön" variant="secondary" onPress={() => onSelect(nowPeriod)} />
            </View>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Arrow({ label, onPress, compact }: { label: string; onPress: () => void; compact?: boolean }) {
  const { c, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingHorizontal: compact ? spacing.sm : spacing.lg,
        paddingVertical: compact ? spacing.xs : spacing.sm,
        borderRadius: radius.sm, backgroundColor: pressed ? glassColors.cardBgSoft : 'transparent',
      })}
    >
      <Txt variant={compact ? 'h3' : 'h2'} color={c.accent}>{label}</Txt>
    </Pressable>
  );
}
