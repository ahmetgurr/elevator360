import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { statusColors, useTheme } from '@/lib/theme';
import { dayLabel, money, moneyShort, num } from '@/lib/format';
import { MODULE_LABEL, type LedgerRow, type ModuleType, type PeriodSummary } from '@/lib/types';
import { PeriodSwitcher } from './pickers';
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
  // is_active migration'dan once undefined olabilir; bkz. matchesQuickFilter yorumu
  const isActive = row.is_active !== false;

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
        opacity: isActive ? 1 : 0.6,
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
        {isActive
          ? <StatusPill statusKey={row.status_key} label={row.status_label} small />
          : <StatusPill statusKey="passive" label="Pasif" small />}
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

/* --------------------------- Patron / kasa ozeti ------------------------- */

export interface ModuleSummaryEntry {
  module: ModuleType;
  summary: PeriodSummary | null | undefined;
}

/**
 * "Bu ay piyasadan toplam ne kadar alacagim var, ne kadari nakit,
 * kalan ne" — esnafin ana ekrana girer girmez tek bakista gormesi
 * gereken 3 metrik. Birden fazla modulun ozetini (site listesi
 * sayfasindaki SummaryStrip'ten farkli olarak) TOPLU gosterir; ay/yil
 * navigasyonu ve tıklanınca acilan modul bazli kirilim ile "zaman
 * yolculugu" yapilabilir.
 */
export function CashSummaryPanel({ entries, loading, period, onPeriodChange }: {
  entries: ModuleSummaryEntry[];
  loading?: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const available = entries.filter(e => !!e.summary);
  const totals = available.reduce(
    (acc, e) => {
      acc.expected += num(e.summary!.total_expected);
      acc.collected += num(e.summary!.total_collected);
      acc.balance += num(e.summary!.total_balance);
      return acc;
    },
    { expected: 0, collected: 0, balance: 0 },
  );
  const rate = totals.expected > 0 ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const hasBreakdown = available.length > 1;

  return (
    <View style={{
      backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      borderTopWidth: 4, borderTopColor: c.accent,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Txt variant="h3" color={c.textMuted}>Genel Kasa Özeti</Txt>
        <View style={{ flex: 1, maxWidth: 220 }}>
          <PeriodSwitcher period={period} onChange={onPeriodChange} />
        </View>
      </View>

      {loading ? (
        <Txt variant="small" color={c.textFaint}>Hesaplanıyor…</Txt>
      ) : available.length === 0 ? (
        <Txt variant="small" color={c.textFaint}>Bu dönem için henüz veri yok.</Txt>
      ) : (
        <>
          <Pressable
            onPress={() => hasBreakdown && setExpanded(v => !v)}
            disabled={!hasBreakdown}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <BigStat label="Toplam Beklenen" value={totals.expected} color={c.text} />
              <BigStat label="Tahsil Edilen" value={totals.collected} color={c.ok} />
              <BigStat label="Kalan Alacak" value={totals.balance} color={c.danger} />
            </View>
            {hasBreakdown && (
              <Txt variant="tiny" color={c.accent} style={{ marginTop: spacing.sm, fontWeight: '700' }}>
                {expanded ? '▴ Modül bazlı dökümü gizle' : '▾ Modül bazlı dökümü gör'}
              </Txt>
            )}
          </Pressable>

          {expanded && hasBreakdown && (
            <View style={{ gap: spacing.sm }}>
              {available.map(e => (
                <View key={e.module} style={{
                  backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
                }}>
                  <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>{MODULE_LABEL[e.module]}</Txt>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <BreakdownStat label="Beklenen" value={num(e.summary!.total_expected)} color={c.textMuted} />
                    <BreakdownStat label="Tahsil" value={num(e.summary!.total_collected)} color={c.ok} />
                    <BreakdownStat label="Kalan" value={num(e.summary!.total_balance)} color={c.danger} />
                  </View>
                </View>
              ))}
            </View>
          )}

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
        </>
      )}
    </View>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2, flex: 1 }}>
      <Txt variant="small" color={c.textFaint}>{label}</Txt>
      <Txt variant="h2" color={color} numberOfLines={1}>{money(value)}</Txt>
    </View>
  );
}

function BreakdownStat({ label, value, color }: { label: string; value: number; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <Txt variant="tiny" color={c.textFaint}>{label}</Txt>
      <Txt variant="moneySm" color={color}>{money(value)}</Txt>
    </View>
  );
}
