import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { moduleAccent, statusColors, useTheme } from '@/lib/theme';
import { dayLabel, isFuturePeriod, money, moneyShort, num } from '@/lib/format';
import { MODULE_LABEL, type LedgerRow, type ModuleType, type PeriodSummary } from '@/lib/types';
import type { ProjectedSite } from '@/lib/api';
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

/* ------------------------- Ongorulen site karti -------------------------- */

/**
 * Gelecek (henuz acilmamis) bir donem icin, o an aktif olan sitelerin
 * "acilacak" halini gosteren mock kart. Gercek bir ledger_id'si YOKTUR;
 * bu yuzden LedgerListItem'i degil, kendi sade gorunumunu kullanir —
 * sahte veriyi gercek bilanco satiri gibi gostermemek icin bilincli
 * bir ayrim (bkz. useProjectedSites).
 */
export function ProjectedSiteListItem({ site, onPress }: {
  site: ProjectedSite; onPress: (site: ProjectedSite) => void;
}) {
  const { c, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={() => onPress(site)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        borderStyle: 'dashed',
        padding: spacing.lg,
        gap: spacing.sm,
        opacity: 0.6,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h3" numberOfLines={1}>{site.site_name}</Txt>
          <Txt variant="tiny" color={c.textFaint}>{site.site_code} · {dayLabel(site.service_day)}</Txt>
        </View>
        <View style={{
          backgroundColor: c.surfaceAlt, borderRadius: radius.pill,
          paddingHorizontal: spacing.sm, paddingVertical: 2,
        }}>
          <Txt variant="tiny" color={c.textFaint} style={{ fontWeight: '700' }}>Zamanı Gelmedi</Txt>
        </View>
      </View>

      <Amount label="Öngörülen Ücret" value={site.monthly_fee} color={c.textMuted} />
    </Pressable>
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

export interface ModuleYearlyEntry {
  module: ModuleType;
  yearly: { total_expected: number; total_collected: number; total_balance: number } | null | undefined;
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
export function CashSummaryPanel({
  entries, projectedEntries, loading, period, onPeriodChange,
  yearlyEntries, yearlyLoading, yearlyOpen, onOpenYearly, onCloseYearly,
}: {
  entries: ModuleSummaryEntry[];
  projectedEntries?: ModuleProjectionEntry[];
  loading?: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
  /** "Tüm Yılı Göster" pop-up'ı icin — hicbiri verilmezse buton gosterilmez */
  yearlyEntries?: ModuleYearlyEntry[];
  yearlyLoading?: boolean;
  yearlyOpen?: boolean;
  onOpenYearly?: () => void;
  onCloseYearly?: () => void;
}) {
  const { c, dark, spacing, radius } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const year = Number(period.slice(0, 4));

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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <View style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: dark ? moduleAccent[r.module].dark : moduleAccent[r.module].light,
                        }} />
                        <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>{MODULE_LABEL[r.module]}</Txt>
                      </View>
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

          {!!onOpenYearly && (
            <Pressable
              onPress={onOpenYearly}
              style={({ pressed }) => ({
                alignItems: 'center', paddingVertical: spacing.sm,
                borderRadius: radius.md, backgroundColor: pressed ? c.surfaceAlt : 'transparent',
                borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
              })}
            >
              <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>🗓 Tüm Yılı Göster</Txt>
            </Pressable>
          )}
        </>
      )}

      <YearlySummaryModal
        visible={!!yearlyOpen}
        year={year}
        entries={yearlyEntries ?? []}
        loading={yearlyLoading}
        onClose={() => onCloseYearly?.()}
      />
    </View>
  );
}

/**
 * "Tüm Yılı Göster" pop-up'ı — o an goruntulenen donemin YILINA ait
 * (Ocak-Aralık, o ana kadar acilmis donemler) toplam Beklenen/Tahsil/Kalan
 * rakamlarini, modul kirilimiyla birlikte gosterir.
 */
function YearlySummaryModal({ visible, year, entries, loading, onClose }: {
  visible: boolean;
  year: number;
  entries: ModuleYearlyEntry[];
  loading?: boolean;
  onClose: () => void;
}) {
  const { c, dark, spacing, radius } = useTheme();

  const totals = entries.reduce(
    (acc, e) => {
      if (!e.yearly) return acc;
      acc.expected += e.yearly.total_expected;
      acc.collected += e.yearly.total_collected;
      acc.balance += e.yearly.total_balance;
      return acc;
    },
    { expected: 0, collected: 0, balance: 0 },
  );
  const hasBreakdown = entries.filter(e => !!e.yearly).length > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(11,21,38,0.55)', justifyContent: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', maxHeight: '80%' }}
        >
          <View style={{
            padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
          }}>
            <Txt variant="h3">{year} Yıllık Bilanço</Txt>
            <Txt variant="tiny" color={c.textFaint}>Ocak – Aralık, o ana kadar açılmış dönemler</Txt>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.lg }}>
            {loading ? (
              <Txt variant="small" color={c.textFaint}>Hesaplanıyor…</Txt>
            ) : (
              <>
                <View style={{ gap: spacing.md }}>
                  <BigStat label="Yıllık Toplam Beklenen" value={totals.expected} color={c.text} full />
                  <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                    <BigStat label="Yıllık Tahsil Edilen" value={totals.collected} color={c.ok} />
                    <BigStat label="Yıllık Kalan Alacak" value={totals.balance} color={c.danger} />
                  </View>
                </View>

                {hasBreakdown && (
                  <View style={{ gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: spacing.md }}>
                    {entries.map(e => (
                      <View key={e.module} style={{
                        backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
                      }}>
                        {e.yearly ? (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                              <View style={{
                                width: 8, height: 8, borderRadius: 4,
                                backgroundColor: dark ? moduleAccent[e.module].dark : moduleAccent[e.module].light,
                              }} />
                              <Txt variant="small" color={c.text} style={{ fontWeight: '700' }}>{MODULE_LABEL[e.module]}</Txt>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <BreakdownStat label="Beklenen" value={e.yearly.total_expected} color={c.textMuted} />
                              <BreakdownStat label="Tahsil" value={e.yearly.total_collected} color={c.ok} />
                              <BreakdownStat label="Kalan" value={e.yearly.total_balance} color={c.danger} />
                            </View>
                          </>
                        ) : (
                          <Txt variant="small" color={c.textFaint}>{MODULE_LABEL[e.module]}: {money(0)} (Kayıt Yok)</Txt>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
