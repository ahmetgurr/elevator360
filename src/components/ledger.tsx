import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { statusColors, useTheme } from '@/lib/theme';
import { dayLabel, isFuturePeriod, money, moneyShort, num } from '@/lib/format';
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
      {/* Mobilde tek satira sigmaya calisip kesilmesin diye: Beklenen
          ustte tek basina genis, Tahsil/Kalan altta yan yana (bkz.
          saha geri bildirimi). */}
      <View style={{ gap: spacing.sm }}>
        <Stat label="Beklenen" value={moneyShort(summary.total_expected)} color={c.text} full />
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Stat label="Tahsil" value={moneyShort(summary.total_collected)} color={c.ok} />
          <Stat label="Kalan"  value={moneyShort(summary.total_balance)}  color={c.danger} />
        </View>
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

function Stat({ label, value, color, full }: { label: string; value: string; color: string; full?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2, flex: full ? undefined : 1 }}>
      <Txt variant="tiny" color={c.textFaint}>{label}</Txt>
      <Txt variant={full ? 'moneyLg' : 'money'} color={color} numberOfLines={1}>{value}</Txt>
    </View>
  );
}

/* --------------------------- Ongorulen bilanco --------------------------- */

/**
 * Henuz acilmamis (gelecek) bir donem icin liste ekraninda gosterilen
 * ONGORU karti. Kesikli kenarlik + soluk renkler ile "gercek veri
 * degil, tahmin" oldugu bilincli olarak ayristirilir.
 */
export function ProjectedSummaryCard({ siteCount, totalExpected }: {
  siteCount: number; totalExpected: number;
}) {
  const { c, spacing, radius } = useTheme();
  return (
    <View style={{
      backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderStyle: 'dashed',
    }}>
      <Txt variant="tiny" color={c.textFaint} style={{ fontWeight: '700' }}>📅 ÖNGÖRÜLEN BİLANÇO</Txt>
      <Txt variant="moneyLg" color={c.textMuted} numberOfLines={1}>{money(totalExpected)}</Txt>
      <Txt variant="tiny" color={c.textFaint}>
        {siteCount > 0
          ? `${siteCount} aktif sitenin güncel ücretlerine göre tahmindir; bu dönem henüz açılmadı.`
          : 'Bu dönemde aktif site bulunmuyor.'}
      </Txt>
    </View>
  );
}

/* --------------------------- Patron / kasa ozeti ------------------------- */

export interface ModuleSummaryEntry {
  module: ModuleType;
  summary: PeriodSummary | null | undefined;
}

export interface ModuleProjectionEntry {
  module: ModuleType;
  projected: { site_count: number; total_expected: number } | null | undefined;
}

interface DisplayRow {
  module: ModuleType;
  expected: number;
  collected: number;
  balance: number;
  hasData: boolean;
}

/**
 * "Bu ay piyasadan toplam ne kadar alacagim var, ne kadari nakit,
 * kalan ne" — esnafin ana ekrana girer girmez tek bakista gormesi
 * gereken 3 metrik. Birden fazla modulun ozetini (site listesi
 * sayfasindaki SummaryStrip'ten farkli olarak) TOPLU gosterir; ay/yil
 * navigasyonu ve tıklanınca acilan modul bazli kirilim ile "zaman
 * yolculugu" yapilabilir.
 *
 * Modul dokumu (breakdown) HER ZAMAN kullanicinin erisimi olan tum
 * moduller icin gosterilir — bir modulde veri yoksa satiri gizlemek
 * yerine "Kayıt Yok" olarak acikca belirtilir.
 *
 * Gercek veri hic yoksa VE goruntulenen donem gelecekteyse (henuz
 * ensure_current_period tarafindan acilmamis), projectedEntries
 * verilmisse "Öngörülen Bilanço" moduna geçilir — bkz. useProjectedSummary.
 */
export function CashSummaryPanel({ entries, projectedEntries, loading, period, onPeriodChange }: {
  entries: ModuleSummaryEntry[];
  projectedEntries?: ModuleProjectionEntry[];
  loading?: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const { c, spacing, radius } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const hasAnyRealData = entries.some(e => !!e.summary);
  const isProjection = !hasAnyRealData && isFuturePeriod(period) && !!projectedEntries;
  const showEmpty = !hasAnyRealData && !isProjection;

  const rows: DisplayRow[] = isProjection
    ? entries.map(e => {
        const p = projectedEntries!.find(pe => pe.module === e.module)?.projected;
        const expected = p?.total_expected ?? 0;
        return { module: e.module, expected, collected: 0, balance: expected, hasData: !!p && p.site_count > 0 };
      })
    : entries.map(e => ({
        module: e.module,
        expected: num(e.summary?.total_expected ?? 0),
        collected: num(e.summary?.total_collected ?? 0),
        balance: num(e.summary?.total_balance ?? 0),
        hasData: !!e.summary,
      }));

  const totals = rows.reduce(
    (acc, r) => { acc.expected += r.expected; acc.collected += r.collected; acc.balance += r.balance; return acc; },
    { expected: 0, collected: 0, balance: 0 },
  );
  const rate = totals.expected > 0 ? Math.round((totals.collected / totals.expected) * 100) : 0;
  const hasBreakdown = rows.length > 1;

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
      ) : showEmpty ? (
        <Txt variant="small" color={c.textFaint}>Bu dönem için henüz veri yok.</Txt>
      ) : (
        <>
          {isProjection && (
            <View style={{
              backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md,
              borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderStyle: 'dashed',
            }}>
              <Txt variant="tiny" color={c.textFaint} style={{ fontWeight: '700' }}>
                📅 ÖNGÖRÜLEN BİLANÇO — aktif sitelerin güncel ücretlerine göre tahmini; bu dönem henüz açılmadı.
              </Txt>
            </View>
          )}

          <Pressable
            onPress={() => hasBreakdown && setExpanded(v => !v)}
            disabled={!hasBreakdown}
          >
            <View style={{ gap: spacing.md }}>
              <BigStat
                label="Toplam Beklenen" value={totals.expected}
                color={isProjection ? c.textMuted : c.text} full
              />
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <BigStat
                  label="Tahsil Edilen" value={totals.collected}
                  color={isProjection ? c.textFaint : c.ok}
                />
                <BigStat
                  label="Kalan Alacak" value={totals.balance}
                  color={isProjection ? c.textFaint : c.danger}
                />
              </View>
            </View>
            {hasBreakdown && (
              <Txt variant="tiny" color={c.accent} style={{ marginTop: spacing.sm, fontWeight: '700' }}>
                {expanded ? '▴ Modül bazlı dökümü gizle' : '▾ Modül bazlı dökümü gör'}
              </Txt>
            )}
          </Pressable>

          {expanded && hasBreakdown && (
            <View style={{ gap: spacing.sm }}>
              {rows.map(r => (
                <View key={r.module} style={{
                  backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
                }}>
                  {r.hasData ? (
                    <>
                      <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>{MODULE_LABEL[r.module]}</Txt>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <BreakdownStat label="Beklenen" value={r.expected} color={c.textMuted} />
                        <BreakdownStat label="Tahsil" value={r.collected} color={c.ok} />
                        <BreakdownStat label="Kalan" value={r.balance} color={c.danger} />
                      </View>
                    </>
                  ) : (
                    <Txt variant="small" color={c.textFaint}>
                      {MODULE_LABEL[r.module]}: {money(0)} (Kayıt Yok)
                    </Txt>
                  )}
                </View>
              ))}
            </View>
          )}

          {!isProjection && (
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
          )}
        </>
      )}
    </View>
  );
}

function BigStat({ label, value, color, full }: { label: string; value: number; color: string; full?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2, flex: full ? undefined : 1 }}>
      <Txt variant="small" color={c.textFaint}>{label}</Txt>
      <Txt variant={full ? 'moneyLg' : 'moneyMd'} color={color} numberOfLines={1}>{money(value)}</Txt>
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
