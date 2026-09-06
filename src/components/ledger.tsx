import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { statusColors, useTheme } from '@/lib/theme';
import { dayLabel, money, moneyShort, num } from '@/lib/format';
import type { LedgerRow, PeriodSummary } from '@/lib/types';
import { Txt } from './ui';

/* ------------------------------ Durum rozeti ---------------------------- */

export function StatusPill({ statusKey, label, small }: {
  statusKey: string; label: string; small?: boolean;
}) {
  const { c, radius, spacing, font } = useTheme();
  const { fg, bg } = statusColors(c, statusKey);
  return (
    <View style={{
      backgroundColor: bg, borderRadius: radius.pill,
      paddingHorizontal: small ? spacing.sm : spacing.md,
      paddingVertical: small ? 2 : 4, alignSelf: 'flex-start',
    }}>
      <Txt variant={small ? 'tiny' : 'small'} color={fg} style={{ fontWeight: '700' }}>
        {label}
      </Txt>
    </View>
  );
}

/* ----------------------------- Liste satiri ----------------------------- */

export function LedgerListItem({ row, onPress }: { row: LedgerRow; onPress: (r: LedgerRow) => void }) {
  const { c, spacing, radius } = useTheme();
  const balance = num(row.balance);
  const paid = num(row.net_paid);

  return (
    <Pressable
      onPress={() => onPress(row)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        padding: spacing.lg,
        gap: spacing.sm,
      })}
    >
      {/* Ust satir: site adi + durum */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h3" numberOfLines={1}>{row.site_name}</Txt>
          <Txt variant="tiny" color={c.textFaint}>
            {row.site_code} · {dayLabel(row.service_day)}
            {row.days_overdue > 0 ? ` · ${row.days_overdue} gün gecikme` : ''}
          </Txt>
        </View>
        <StatusPill statusKey={row.status_key} label={row.status_label} small />
      </View>

      {/* Alt satir: tutarlar */}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
        <Amount label="Toplam" value={row.total_due} color={c.textMuted} />
        <Amount label="Ödenen" value={row.net_paid}
                color={paid > 0 ? c.ok : c.textFaint} />
        <Amount label="Kalan" value={row.balance}
                color={balance > 0 ? c.danger : c.ok} strong />
      </View>

      {num(row.extra_total) > 0 || num(row.discount_total) > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {num(row.extra_total) > 0 && (
            <Txt variant="tiny" color={c.warn}>+ Ekstra {moneyShort(row.extra_total)}</Txt>
          )}
          {num(row.discount_total) > 0 && (
            <Txt variant="tiny" color={c.info}>− İndirim {moneyShort(row.discount_total)}</Txt>
          )}
          {row.entry_count > 0 && (
            <Txt variant="tiny" color={c.textFaint}>{row.entry_count} hareket</Txt>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

function Amount({ label, value, color, strong }: {
  label: string; value: string; color: string; strong?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <Txt variant="tiny" color={c.textFaint}>{label}</Txt>
      <Txt variant={strong ? 'money' : 'moneySm'} color={color}>{money(value)}</Txt>
    </View>
  );
}

/* ---------------------------- Donem ozet kartlari ----------------------- */

export function SummaryStrip({ summary }: { summary: PeriodSummary | null | undefined }) {
  const { c, spacing, radius } = useTheme();
  if (!summary) return null;

  const rate = Math.round(num(summary.collection_rate_pct));

  return (
    <View style={{
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, gap: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Stat label="Beklenen"  value={moneyShort(summary.total_expected)}  color={c.text} />
        <Stat label="Tahsil"    value={moneyShort(summary.total_collected)} color={c.ok} />
        <Stat label="Kalan"     value={moneyShort(summary.total_balance)}   color={c.danger} />
      </View>

      {/* Tahsilat orani */}
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="tiny" color={c.textFaint}>Tahsilat oranı</Txt>
          <Txt variant="tiny" color={c.textMuted}>%{rate}</Txt>
        </View>
        <View style={{ height: 6, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}>
          <View style={{
            width: `${Math.min(100, Math.max(0, rate))}%`, height: '100%',
            backgroundColor: rate >= 80 ? c.ok : rate >= 40 ? c.accent : c.danger,
          }} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <Txt variant="tiny" color={c.textFaint}>{summary.site_count} site</Txt>
        <Txt variant="tiny" color={c.ok}>{summary.completed_count} tamamlandı</Txt>
        <Txt variant="tiny" color={c.warn}>{summary.partial_count} eksik</Txt>
        <Txt variant="tiny" color={c.danger}>{summary.overdue_count} gecikmiş</Txt>
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="tiny" color={c.textFaint}>{label}</Txt>
      <Txt variant="money" color={color}>{value}</Txt>
    </View>
  );
}
