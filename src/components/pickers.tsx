import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { periodLabel, shiftPeriod, currentPeriod } from '@/lib/format';
import { Button, Txt } from './ui';

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

/* ---------------------------------- Arama --------------------------------- */

export function SearchBar({ value, onChange, placeholder = 'Site adı ara…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const { c, spacing, radius, font } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: c.surface, borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      paddingHorizontal: spacing.md,
    }}>
      <Txt variant="body" color={c.textFaint}>🔍</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={100}
        style={[font.body, { flex: 1, color: c.text, paddingVertical: spacing.md }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <Txt variant="h3" color={c.textFaint}>✕</Txt>
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
  const { c, spacing, radius, font } = useTheme();
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
            backgroundColor: c.accentSoft,
            borderRadius: radius.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Txt variant="small" color={c.accent} numberOfLines={1} style={{ fontWeight: '700' }}>{compact.icon} {compact.label}</Txt>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
            backgroundColor: pressed ? c.surfaceAlt : c.surface,
            borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
            borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
          })}
        >
          <Txt variant="small" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{current.label}</Txt>
          <Txt variant="tiny" color={c.textMuted} numberOfLines={1} style={{ flexShrink: 0 }}>
            {counts?.[value] !== undefined ? `${counts[value]} site  ▾` : '▾'}
          </Txt>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}
          >
            <View style={{ padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
              <Txt variant="h3">{title}</Txt>
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
                      backgroundColor: active ? c.accentSoft : pressed ? c.surfaceAlt : 'transparent',
                    })}
                  >
                    <Txt variant="body" color={active ? c.accent : c.text}
                         style={{ fontWeight: active ? '700' : '400' }}>
                      {opt.label}
                    </Txt>
                    <Txt variant="small" color={c.textFaint}>
                      {counts?.[opt.key] !== undefined ? String(counts[opt.key]) : ''}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ----------------------------- Donem secici ----------------------------- */

export function PeriodSwitcher({ period, onChange }: {
  period: string; onChange: (p: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface, borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    }}>
      <Arrow label="‹" onPress={() => onChange(shiftPeriod(period, -1))} />
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}
      >
        <Txt variant="h3">{periodLabel(period)}</Txt>
        <Txt variant="small" color={c.textFaint}>▾</Txt>
      </Pressable>
      <Arrow label="›" onPress={() => onChange(shiftPeriod(period, 1))} />

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}
        >
          <View style={{ padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}>
            <Txt variant="h3">Ay / Yıl Seç</Txt>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
              <Arrow label="‹" onPress={() => setYear(v => v - 1)} />
              <Txt variant="h2">{year}</Txt>
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
                      backgroundColor: active ? c.accent : pressed ? c.surfaceAlt : c.bg,
                      borderWidth: isNow && !active ? StyleSheet.hairlineWidth : 0,
                      borderColor: c.accent,
                    })}
                  >
                    <Txt variant="small" color={active ? c.onAccent : c.text}
                         style={{ fontWeight: active ? '700' : '400' }}>
                      {label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>

            <Button title="Bu Aya Dön" variant="secondary" onPress={() => onSelect(nowPeriod)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Arrow({ label, onPress }: { label: string; onPress: () => void }) {
  const { c, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderRadius: radius.sm, backgroundColor: pressed ? c.surfaceAlt : 'transparent',
      })}
    >
      <Txt variant="h2" color={c.accent}>{label}</Txt>
    </Pressable>
  );
}
