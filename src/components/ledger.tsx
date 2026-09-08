import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { glassColors, glassTextShadow, moduleAccent, statusColors, useTheme } from '@/lib/theme';
import { currentPeriod, dayLabel, isFuturePeriod, money, moneyShort, num, periodFileLabel, periodLabel, shiftPeriod } from '@/lib/format';
import {
  MODULE_LABEL, finalBalanceState, isUnrealizedFuture, overpaidAmount,
  type LedgerRow, type ModuleType, type PeriodSummary,
} from '@/lib/types';
import { useRangeSummary, type ProjectedSite, type RangePeriodSummary } from '@/lib/api';
import { exportRangeSummaryExcel, type RangeExcelRow } from '@/lib/export';
import { PeriodSwitcher } from './pickers';
import { ModalShell, Txt } from './ui';
import { GlassCard, GlassProgressBar, GradientButton, androidRipple, pressScaleStyle, bounceScrollProps } from './Glass';

/* ------------------------------ Durum rozeti ---------------------------- */

export function StatusPill({ statusKey, label, small }: {
  statusKey: string; label: string; small?: boolean;
}) {
  const { c, radius, spacing } = useTheme();
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
  // is_active migration'dan once undefined olabilir; bkz. matchesQuickFilter yorumu
  const isActive = row.is_active !== false;
  // Henuz icinde bulunulmadigimiz (gelecek) bir donem icin: notu, ekstrasi,
  // gecmisten devreden borcu NE OLURSA OLSUN — gercek bir islem girilmis
  // olsa bile — esnafa GERCEK bir bilanco satiri gibi gorunmemeli. Diger
  // "oncelenen" (henuz acilmamis) kartlarla BIREBIR AYNI sade/silik
  // gorunumde gosterilir (bkz. kullanici geri bildirimi: "Beta sitesi neden
  // seffaf degil, o da oncelenen degil mi, ne olursa olsun silik gorunmeli").
  const unrealized = isActive && isUnrealizedFuture(row);

  if (unrealized) {
    return (
      <Pressable
        onPress={() => onPress(row)}
        android_ripple={androidRipple}
        style={({ pressed }) => [{
          backgroundColor: pressed ? glassColors.rowBgPressed : glassColors.rowBg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: glassColors.cardBorder,
          borderStyle: 'dashed',
          padding: spacing.lg,
          gap: spacing.sm,
          opacity: 0.7,
        }, pressScaleStyle(pressed)]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="h3" numberOfLines={1}>{row.site_name}</Txt>
            <Txt variant="tiny" color={c.textFaint}>{row.site_code} · {dayLabel(row.service_day)}</Txt>
          </View>
          <StatusPill statusKey="future" label="Zamanı Gelmedi" small />
        </View>
        <Amount label="Öngörülen Ücret" value={row.base_fee} color={c.textMuted} />
      </Pressable>
    );
  }

  const balance = num(row.balance);
  const paid = num(row.net_paid);
  const carriedOver = num(row.carried_over_balance);
  const hasCarriedOverDebt = carriedOver >= 0.01;
  const looksSettled = row.status_key === 'completed' || row.status_key === 'overpaid';
  // Bu ay fazla odeme (balance negatif) VE gecmisten borc varsa: kartta
  // ham negatif "Kalan" kafa karistirir (bkz. kullanici geri bildirimi —
  // "-1.000 ₺" yaziyor ama aslinda gecmis borc kapanmis). Bunun yerine
  // gercek net durumu (gecmis borc + bu ayki fazla odeme) hesaplayip
  // "Kapatildi/Sifirlandi" ya da gercek kalan borcu gosteririz.
  const isOverpaidThisMonth = balance < -0.01;
  const netAfterCarryover = carriedOver + balance;
  const carryoverCleared = isOverpaidThisMonth && hasCarriedOverDebt && netAfterCarryover <= 0.01;
  const carryoverStillOwed = isOverpaidThisMonth && hasCarriedOverDebt && netAfterCarryover > 0.01;
  const extraCredit = carryoverCleared && netAfterCarryover < -0.01 ? -netAfterCarryover : 0;
  // Gecmisten borc YOKKEN sadece bu ay fazla odeme girildiyse (basit
  // fazla odeme): ham negatif "Kalan" yerine pozitif "Fazla Ödenen"
  // etiketiyle gosterilir — bkz. kullanici geri bildirimi.
  const simpleOverpaid = !carryoverCleared && !carryoverStillOwed ? overpaidAmount(balance) : null;
  // "Kalan"/"Fazla Ödenen" etiketleri "Bu Ay" onekiyle netlestirilir (bkz.
  // kullanici geri bildirimi) — TEK ISTISNA: carryoverStillOwed durumunda
  // gosterilen tutar artik BU AYIN KENDI degeri DEGIL, gecmisten devreden
  // borc dahil NET toplamdir; "Bu Ay Kalan" demek YANLIS olurdu, bu yuzden
  // "Toplam Kalan" kullanilir (bkz. kullanici geri bildirimi: kirmizi
  // "gecmis borc var" ile yesil "fazla odemis" AYNI ANDA gorunmemeli —
  // burada zaten TEK bir kirmizi "Toplam Kalan" mesaji var, celisen ikinci
  // bir yesil mesaj YOK).
  const remainingAmount = carryoverCleared
    ? { label: 'Bu Ay Kalan', value: '0', color: c.ok }
    : carryoverStillOwed
      ? { label: 'Toplam Kalan', value: String(netAfterCarryover), color: c.danger }
      : simpleOverpaid !== null
        ? { label: 'Bu Ay Fazla Ödenen', value: String(simpleOverpaid), color: c.ok }
        : { label: 'Bu Ay Kalan', value: row.balance, color: balance > 0 ? c.danger : c.ok };
  // Gecmis bir ay kartina bakilirken bile sitenin BUGUNKU nihai bakiyesi
  // net gorunsun — bkz. kullanici geri bildirimi (Bozyel 4 senaryosu):
  // Temmuz karti kendi basina borclu gorunse bile, site Agustos'ta toplu
  // odemeyle kapanmis olabilir.
  const finalState = finalBalanceState(num(row.site_current_balance));

  return (
    <Pressable
      onPress={() => onPress(row)}
      android_ripple={androidRipple}
      style={({ pressed }) => [{
        backgroundColor: pressed ? glassColors.rowBgPressed : glassColors.rowBg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: glassColors.cardBorder,
        padding: spacing.lg,
        gap: spacing.sm,
        opacity: !isActive ? 0.6 : 1,
      }, pressScaleStyle(pressed)]}
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
        {!isActive
          ? <StatusPill statusKey="passive" label="Pasif" small />
          : <StatusPill statusKey={row.status_key} label={row.status_label} small />}
      </View>

      {/* Alt satir: tutarlar — etiketler "Bu Ay" onekiyle netlestirilir (bkz.
          kullanici geri bildirimi: "Kalan yerine Bu Ay Kalan yazsın, Ödenen
          yerine Bu Ay Ödenen yazsın"). remainingAmount.label kendisi zaten
          "Toplam Kalan" gibi kapsamı netleştiren bir etiket dönebiliyorsa
          (carryoverStillOwed — bkz. asağıda) OLDUĞU GİBİ kullanılır; "Bu Ay"
          öneki SADECE bu ayın kendi tutarını yansıtan durumlarda eklenir. */}
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
        <Amount label="Bu Ay Toplam" value={row.total_due} color={c.textMuted} />
        <Amount label="Bu Ay Ödenen" value={row.net_paid}
                color={paid > 0 ? c.ok : c.textFaint} />
        <Amount label={remainingAmount.label} value={remainingAmount.value} color={remainingAmount.color} strong />
      </View>

      {num(row.extra_total) > 0 || num(row.discount_total) > 0 || row.entry_count > 0 ? (
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

      {/* Kumulatif gecmis borc uyarisi: "Tamamlandı" yazan bir kart bile
          esnafi yanlis anlamaya sevk etmesin — bkz. kullanici geri bildirimi.
          Bu ay fazla odeme gecmis borcu kapattiysa/asdiysa, ham negatif
          "Kalan" yerine akilli, net durumu anlatan bir mesaj gosterilir. */}
      {isActive && carryoverCleared && (
        <View style={{
          backgroundColor: c.okSoft, borderRadius: radius.sm,
          paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start',
        }}>
          <Txt variant="tiny" color={c.ok} style={{ fontWeight: '700' }}>
            ✓ Geçmiş Borç Kapatıldı / Sıfırlandı{extraCredit >= 0.01 ? ` (+${money(extraCredit)} sonraki aya devreder)` : ''}
          </Txt>
        </View>
      )}
      {isActive && carryoverStillOwed && (
        <View style={{
          backgroundColor: c.dangerSoft, borderRadius: radius.sm,
          paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start',
        }}>
          <Txt variant="tiny" color={c.danger} style={{ fontWeight: '700' }}>
            ⚠ Bu Ayki Fazla Ödemeye Rağmen Kalan Geçmiş Borç: {money(netAfterCarryover)}
          </Txt>
        </View>
      )}
      {/* "Bu Dönemden Önceki" ile BASKA — deger bu SATIRIN doneminden ONCEKI
          aylarin toplamidir, farkli ay kartlarina bakildikca DEGISIR (bkz.
          kullanici geri bildirimi: ay ay farkli rakam gorunmesi kafa
          karistirdi). Sabit/TEK toplam icin asagidaki "Sitenin Güncel
          Bakiyesi (Bugün)" paneli kullanilir. */}
      {isActive && !isOverpaidThisMonth && hasCarriedOverDebt && (
        <View style={{
          backgroundColor: c.dangerSoft, borderRadius: radius.sm,
          paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start',
        }}>
          <Txt variant="tiny" color={c.danger} style={{ fontWeight: '700' }}>
            ⚠ Bu Dönemden Önceki Devreden Borç: {money(carriedOver)}
          </Txt>
        </View>
      )}
      {isActive && !hasCarriedOverDebt && !carryoverCleared && looksSettled && (
        <Txt variant="tiny" color={c.ok}>✓ Bu dönemden önceki devreden borcu yok</Txt>
      )}

      {/* ARTIK isPastPeriod ile SINIRLI DEGIL — sitenin TUM verilerine gore
          hesaplanan TEK, SABIT toplami gosterir; hangi ay kartina bakilirsa
          bakilsin AYNI kalir (bkz. kullanici geri bildirimi: "o tutar öyle
          her aya göre değişmeyecek, tüm veriler esas alınarak
          hesaplanması gerekiyor" — Bozyel 4 senaryosu). */}
      {isActive && (
        <View style={{
          backgroundColor: finalState.kind === 'debt' ? c.dangerSoft : c.okSoft,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start',
        }}>
          <Txt variant="tiny" color={finalState.kind === 'debt' ? c.danger : c.ok}>
            📌 Sitenin Güncel Bakiyesi (Bugün):{' '}
            {finalState.kind === 'debt'
              ? `${money(finalState.amount)} Borçlu`
              : finalState.kind === 'credit'
                ? `${money(finalState.amount)} Alacaklı (Fazla Ödeme)`
                : 'Sıfırlandı (Borcu Yok)'}
          </Txt>
        </View>
      )}
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
      <Txt variant={strong ? 'money' : 'moneySm'} color={color} style={glassTextShadow}>{money(value)}</Txt>
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
        backgroundColor: pressed ? glassColors.rowBgPressed : glassColors.rowBg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: glassColors.cardBorder,
        borderStyle: 'dashed',
        padding: spacing.lg,
        gap: spacing.sm,
        opacity: 0.7,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h3" numberOfLines={1}>{site.site_name}</Txt>
          <Txt variant="tiny" color={c.textFaint}>{site.site_code} · {dayLabel(site.service_day)}</Txt>
        </View>
        <View style={{
          backgroundColor: glassColors.cardBgSoft, borderRadius: radius.pill,
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
  const { spacing } = useTheme();
  const [viewMode, setViewMode] = useState<'chart' | 'details'>('chart');

  function changeViewMode(mode: 'chart' | 'details') {
    if (mode === viewMode) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(mode);
  }

  if (!summary) return null;

  const rate = Math.round(num(summary.collection_rate_pct));
  const rateTier = rate >= 80 ? 'positive' : rate >= 40 ? 'primary' : 'danger';

  return (
    <GlassCard contentStyle={{ gap: spacing.md }}>
      {/* Modul detay ekranindaki Bilanço karti — Dashboard'daki "Genel Kasa
          Özeti" (CashSummaryPanel) ile BIREBIR ayni toggle + halka grafik
          mimarisi (bkz. kullanici geri bildirimi). Toggle'in sagindaki bosluk
          "boş kaldı" gorundugu icin (bkz. kullanici geri bildirimi) yanina
          kart basligi eklendi. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => changeViewMode('chart')}
            android_ripple={androidRipple}
            style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'chart' && styles.viewToggleBtnActive, pressScaleStyle(pressed)]}
          >
            <Ionicons name="pie-chart" size={20} color={viewMode === 'chart' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
          </Pressable>
          <Pressable
            onPress={() => changeViewMode('details')}
            android_ripple={androidRipple}
            style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'details' && styles.viewToggleBtnActive, pressScaleStyle(pressed)]}
          >
            <Ionicons name="document-text" size={20} color={viewMode === 'details' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
          </Pressable>
        </View>
        <Txt variant="h3" color={glassColors.textPrimary} numberOfLines={1}>Bilanço Özeti</Txt>
      </View>

      {viewMode === 'chart' ? (
        <BalanceDonutChart expected={num(summary.total_expected)} collected={num(summary.total_collected)} balance={num(summary.total_balance)} />
      ) : (
        <>
          {/* Mobilde tek satira sigmaya calisip kesilmesin diye: Beklenen
              ustte tek basina genis, Tahsil/Kalan altta yan yana (bkz.
              saha geri bildirimi). */}
          <View style={{ gap: spacing.sm }}>
            <Stat label="Beklenen" value={moneyShort(summary.total_expected)} color={glassColors.textPrimary} full />
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <Stat label="Tahsil" value={moneyShort(summary.total_collected)} color={glassColors.accentLight} />
              <Stat label="Kalan"  value={moneyShort(summary.total_balance)}  color={glassColors.danger} />
            </View>
          </View>

          {/* Tahsilat orani */}
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="tiny" color={glassColors.textSecondary}>Tahsilat oranı</Txt>
              <Txt variant="tiny" color={glassColors.textPrimary}>%{rate}</Txt>
            </View>
            <GlassProgressBar value={rate} tier={rateTier} />
          </View>
        </>
      )}

      {/* Bu 4 sayi (tamamlandı+eksik+bekliyor+gecikmiş) HER ZAMAN site
          sayisina esittir — bkz. 0011 migration (birbiriyle kesisen
          kategoriler yuzunden eskiden toplam tutmuyordu). Grafik/detay
          gorunumunden BAGIMSIZ, HER ZAMAN gosterilir (bkz. kullanici geri
          bildirimi — grafik moduna gecince bu satir kayboluyordu). Dar
          ekranlarda yan yana sigmadigi icin yatay kaydirilabilir bir
          seride gosterilir. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: spacing.md }}
      >
        <Txt variant="tiny" color={glassColors.textSecondary}>{summary.site_count} site</Txt>
        <Txt variant="tiny" color={glassColors.accentLight}>{summary.completed_count} tamamlandı</Txt>
        <Txt variant="tiny" color={glassColors.warning}>{summary.partial_count} eksik</Txt>
        <Txt variant="tiny" color={glassColors.textSecondary}>{summary.pending_count} bekliyor</Txt>
        <Txt variant="tiny" color={glassColors.danger}>{summary.overdue_count} gecikmiş</Txt>
      </ScrollView>
    </GlassCard>
  );
}

function Stat({ label, value, color, full }: { label: string; value: string; color: string; full?: boolean }) {
  return (
    <View style={{ gap: 2, flex: full ? undefined : 1 }}>
      <Txt variant="tiny" color={glassColors.textSecondary}>{label}</Txt>
      <Txt variant={full ? 'moneyLg' : 'money'} color={color} numberOfLines={1} style={glassTextShadow}>{value}</Txt>
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
  const { spacing } = useTheme();
  return (
    <GlassCard contentStyle={{ gap: spacing.sm }}>
      <Txt variant="tiny" color={glassColors.textSecondary} style={{ fontWeight: '700' }}>📅 ÖNGÖRÜLEN BİLANÇO</Txt>
      <Txt variant="moneyLg" color={glassColors.textPrimary} numberOfLines={1} style={glassTextShadow}>{money(totalExpected)}</Txt>
      <Txt variant="tiny" color={glassColors.textSecondary}>
        {siteCount > 0
          ? `${siteCount} aktif sitenin güncel ücretlerine göre tahmindir; bu dönem henüz açılmadı.`
          : 'Bu dönemde aktif site bulunmuyor.'}
      </Txt>
    </GlassCard>
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

/**
 * Beklenen/Tahsil/Kalan icin halka grafik + sag tarafta legend (bkz.
 * kullanici geri bildirimi — Ziraat Bankasi tarzi toggle). Hem Dashboard'daki
 * "Genel Kasa Özeti" (CashSummaryPanel) hem de modul detay ekranindaki
 * "Bilanço" karti (SummaryStrip) BIREBIR AYNI bu bileseni kullanir.
 *
 * Merkez HER ZAMAN "Toplam Beklenen" gosterir, dilime basinca DEGISMEZ
 * (bkz. kullanici geri bildirimi: merkezde degisen metin "anlasilmiyor",
 * sabit kalmali). Basilan dilimin bilgisi bunun yerine grafigin ustunde
 * ayri, birkac saniye sonra otomatik kaybolan bir bildirim kutusunda
 * gosterilir. Onceki tikta acilan zamanlayici ust uste tiklamalarda
 * cakismasin diye HER zaman once temizlenir (clearTimeout) — bkz.
 * kullanici geri bildirimi: ilk tiklamada anlik "sifirlanip geri dusme"
 * sorunu, PieChart'a HER render'da YENI bir `data` dizisi referansi
 * verilmesinden kaynaklaniyordu (kutuphane, `data` referansi degisince
 * odaklanan dilimi otomatik -1'e resetliyor — bkz. gifted-charts-core
 * usePieChart). `useMemo` ile `data` referansi SADECE gercek tutarlar
 * degisince yenilenir.
 */
function BalanceDonutChart({ expected, collected, balance }: {
  expected: number; collected: number; balance: number;
}) {
  const [activeSlice, setActiveSlice] = useState<'tahsil' | 'kalan' | null>(null);
  const revertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (revertTimeout.current) clearTimeout(revertTimeout.current);
  }, []);

  function showSlice(slice: 'tahsil' | 'kalan') {
    if (revertTimeout.current) clearTimeout(revertTimeout.current);
    setActiveSlice(slice); // aninda guncellenir
    revertTimeout.current = setTimeout(() => {
      setActiveSlice(null);
      revertTimeout.current = null;
    }, 3500);
  }

  const collectedPct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  const balancePct = expected > 0 ? 100 - collectedPct : 0;

  const pieData = useMemo(
    () =>
      expected > 0
        ? [
            { value: collected, color: '#059669', onPress: () => showSlice('tahsil') },
            { value: balance, color: '#D32F2F', onPress: () => showSlice('kalan') },
          ]
        : [{ value: 1, color: glassColors.trackBg }],
    [expected, collected, balance],
  );

  return (
    <View style={styles.chartRow}>
      <View style={styles.chartWrap}>
        <PieChart
          data={pieData}
          donut
          radius={88}
          innerRadius={60}
          innerCircleColor="#12203A"
          strokeColor="#12203A"
          strokeWidth={3}
          curvedStartEdges
          curvedEndEdges
          edgesRadius={4}
          isAnimated
          animationDuration={500}
          // NOT: `focusOnPress`/`extraRadius` (dilimi disari tasirma efekti)
          // BILEREK KULLANILMIYOR — o odaklanma durumu kutuphane tarafindan
          // internal yonetiliyor ve bizim kendi setTimeout'umuzla senkron
          // sifirlanmiyordu; bildirim kutusu 3.5sn sonra kayboluyor ama
          // dilim "sisik" kaliyordu (bkz. kullanici geri bildirimi: "grafik
          // inmiyor"). Hangi renge basildigi zaten bildirim kutusundaki
          // renkli nokta ile belli oluyor.
          // Merkez HER ZAMAN "Toplam Beklenen" gosterir, dilime basinca
          // DEGISMEZ (bkz. kullanici geri bildirimi — merkezde degisen
          // metin "anlasilmiyor", sabit kalmali). Basilan dilimin bilgisi
          // bunun yerine grafigin ustunde ayri bir bildirim kutusunda
          // gosterilir (asagida, chartWrap icinde konumlanir).
          centerLabelComponent={() => (
            <View style={styles.chartCenter}>
              <Txt variant="tiny" color={glassColors.textSecondary} numberOfLines={1}>Toplam Beklenen</Txt>
              <Txt
                color={glassColors.textPrimary} numberOfLines={1}
                style={[glassTextShadow, { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }]}
              >
                {money(expected)}
              </Txt>
            </View>
          )}
        />
        {activeSlice && (
          <View style={styles.sliceTooltip} pointerEvents="none">
            <View style={styles.sliceTooltipBox}>
              <View style={styles.sliceTooltipHeader}>
                <View style={[styles.legendDot, { backgroundColor: activeSlice === 'tahsil' ? '#059669' : '#D32F2F' }]} />
                <Txt variant="tiny" color={glassColors.textSecondary} numberOfLines={1}>
                  {activeSlice === 'tahsil' ? `%${collectedPct} Tahsil Edilen` : `%${balancePct} Kalan Alacak`}
                </Txt>
              </View>
              <Txt
                color={glassColors.textPrimary} numberOfLines={1}
                style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
              >
                {money(activeSlice === 'tahsil' ? collected : balance)}
              </Txt>
            </View>
          </View>
        )}
      </View>

      <View style={styles.legendCol}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
          <View style={{ flexShrink: 1 }}>
            <Txt variant="tiny" color={glassColors.textSecondary}>Tahsil Edilen</Txt>
            <Txt variant="small" color={glassColors.textPrimary} style={{ fontWeight: '700' }}>{money(collected)}</Txt>
          </View>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D32F2F' }]} />
          <View style={{ flexShrink: 1 }}>
            <Txt variant="tiny" color={glassColors.textSecondary}>Kalan Alacak</Txt>
            <Txt variant="small" color={glassColors.textPrimary} style={{ fontWeight: '700' }}>{money(balance)}</Txt>
          </View>
        </View>
      </View>
    </View>
  );
}
export function CashSummaryPanel({
  entries, projectedEntries, loading, period, onPeriodChange,
  rangeOpen, onOpenRange, onCloseRange,
}: {
  entries: ModuleSummaryEntry[];
  projectedEntries?: ModuleProjectionEntry[];
  loading?: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
  /** "Tüm Yılı Göster" pop-up'ı icin — onOpenRange verilmezse buton gosterilmez */
  rangeOpen?: boolean;
  onOpenRange?: () => void;
  onCloseRange?: () => void;
}) {
  const { dark, spacing } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'details'>('chart');

  function changeViewMode(mode: 'chart' | 'details') {
    if (mode === viewMode) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(mode);
  }

  const hasAnyRealData = entries.some(e => !!e.summary);
  // Gelecek bir donemde bazi siteler icin simdiden gercek satir acilmis olsa
  // bile (ornek: erken girilmis bir ekstra) panel HER ZAMAN oncelenen
  // formatta kalir — kismi gercek veri "bu ayin gercek ozeti" gibi
  // gorunmemeli (bkz. kullanici geri bildirimi).
  const isProjection = isFuturePeriod(period) && !!projectedEntries;
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
  const rateTier = rate >= 80 ? 'positive' : rate >= 40 ? 'primary' : 'danger';
  const hasBreakdown = rows.length > 1;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <Txt variant="h3" color={glassColors.textPrimary} numberOfLines={1} style={{ flexShrink: 1, paddingTop: 4 }}>Genel Kasa Özeti</Txt>
        <PeriodSwitcher period={period} onChange={onPeriodChange} compact />
      </View>

      {loading ? (
        <Txt variant="small" color={glassColors.textSecondary}>Hesaplanıyor…</Txt>
      ) : showEmpty ? (
        <Txt variant="small" color={glassColors.textSecondary}>Bu dönem için henüz veri yok.</Txt>
      ) : isProjection ? (
        <>
          <View style={{
            backgroundColor: 'transparent',
            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: spacing.md,
          }}>
            <Txt variant="tiny" color={glassColors.textSecondary} style={{ fontWeight: '700' }}>
              📅 ÖNGÖRÜLEN BİLANÇO — aktif sitelerin güncel ücretlerine göre tahmini; bu dönem henüz açılmadı.
            </Txt>
          </View>

          <View style={{ gap: spacing.md }}>
            <BigStat label="Toplam Beklenen" value={totals.expected} color={glassColors.textSecondary} labelColor={glassColors.textSecondary} full />
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <BigStat label="Tahsil Edilen" value={totals.collected} color={glassColors.textSecondary} labelColor={glassColors.textSecondary} />
              <BigStat label="Kalan Alacak" value={totals.balance} color={glassColors.textSecondary} labelColor={glassColors.textSecondary} />
            </View>
          </View>

          {!!onOpenRange && (
            <GradientButton title="Tüm Yılı Göster" icon="📊" variant="outline" onPress={onOpenRange} />
          )}
        </>
      ) : (
        <>
          {/* Grafik / Sayısal detay gecis anahtari — bkz. kullanici geri
              bildirimi: Ziraat Bankası Borsa uygulamasi tarzi ikili toggle. */}
          <View style={styles.viewToggle}>
            <Pressable
              onPress={() => changeViewMode('chart')}
              android_ripple={androidRipple}
              style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'chart' && styles.viewToggleBtnActive, pressScaleStyle(pressed)]}
            >
              <Ionicons name="pie-chart" size={20} color={viewMode === 'chart' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
            </Pressable>
            <Pressable
              onPress={() => changeViewMode('details')}
              android_ripple={androidRipple}
              style={({ pressed }) => [styles.viewToggleBtn, viewMode === 'details' && styles.viewToggleBtnActive, pressScaleStyle(pressed)]}
            >
              <Ionicons name="document-text" size={20} color={viewMode === 'details' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
            </Pressable>
          </View>

          {viewMode === 'chart' ? (
            <BalanceDonutChart expected={totals.expected} collected={totals.collected} balance={totals.balance} />
          ) : (
            <>
              <Pressable
                onPress={() => hasBreakdown && setExpanded(v => !v)}
                disabled={!hasBreakdown}
                android_ripple={hasBreakdown ? androidRipple : undefined}
                style={({ pressed }) => (hasBreakdown ? pressScaleStyle(pressed) : undefined)}
              >
                <View style={{ gap: spacing.md }}>
                  <BigStat label="Toplam Beklenen" value={totals.expected} color={glassColors.textPrimary} labelColor={glassColors.textSecondary} full />
                  <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                    <BigStat label="Tahsil Edilen" value={totals.collected} color={glassColors.accentLight} labelColor={glassColors.textSecondary} />
                    <BigStat label="Kalan Alacak" value={totals.balance} color={glassColors.danger} labelColor={glassColors.textSecondary} />
                  </View>
                </View>
                {hasBreakdown && (
                  <Txt variant="tiny" color={glassColors.primaryLight} style={{ marginTop: spacing.sm, fontWeight: '700' }}>
                    {expanded ? '▴ Modül bazlı dökümü gizle' : '▾ Modül bazlı dökümü gör'}
                  </Txt>
                )}
              </Pressable>

              {expanded && hasBreakdown && (
                <View style={{ gap: spacing.sm }}>
                  {rows.map(r => (
                    <View key={r.module} style={{
                      backgroundColor: 'transparent',
                      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
                      paddingTop: spacing.md, gap: spacing.sm,
                    }}>
                      {r.hasData ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                            <View style={{
                              width: 8, height: 8, borderRadius: 4,
                              backgroundColor: dark ? moduleAccent[r.module].dark : moduleAccent[r.module].light,
                            }} />
                            <Txt variant="small" color={glassColors.textPrimary} style={{ fontWeight: '700' }}>{MODULE_LABEL[r.module]}</Txt>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <BreakdownStat label="Beklenen" value={r.expected} color={glassColors.textSecondary} labelColor={glassColors.textSecondary} />
                            <BreakdownStat label="Tahsil" value={r.collected} color={glassColors.accentLight} labelColor={glassColors.textSecondary} />
                            <BreakdownStat label="Kalan" value={r.balance} color={glassColors.danger} labelColor={glassColors.textSecondary} />
                          </View>
                        </>
                      ) : (
                        <Txt variant="small" color={glassColors.textSecondary}>
                          {MODULE_LABEL[r.module]}: {money(0)} (Kayıt Yok)
                        </Txt>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt variant="tiny" color={glassColors.textSecondary}>Tahsilat oranı</Txt>
                  <Txt variant="tiny" color={glassColors.textPrimary}>%{rate}</Txt>
                </View>
                <GlassProgressBar value={rate} tier={rateTier} />
              </View>
            </>
          )}

          {!!onOpenRange && (
            <GradientButton title="Tüm Yılı Göster" icon="📊" variant="outline" onPress={onOpenRange} />
          )}
        </>
      )}

      <RangeSummaryModal
        visible={!!rangeOpen}
        modules={entries.map(e => e.module)}
        onClose={() => onCloseRange?.()}
      />
    </View>
  );
}

/**
 * "Tarih Aralığı Bilançosu" pop-up'ı — kullanicinin secebilecegi bir
 * [Başlangıç Ayı, Bitiş Ayı] araligina ait toplam Beklenen/Tahsil/Kalan'i,
 * VE modul basina ay-ay (en guncelden eskiye, kaydirilabilir) kirilimi
 * gosterir. Varsayilan aralik: bu yilin Ocak'i — bu ay.
 */
function RangeSummaryModal({ visible, modules, onClose }: {
  visible: boolean;
  modules: ModuleType[];
  onClose: () => void;
}) {
  const { c, dark, spacing, radius } = useTheme();
  const [startPeriod, setStartPeriod] = useState(`${new Date().getFullYear()}-01-01`);
  const [endPeriod, setEndPeriod] = useState(currentPeriod());
  const [collapsed, setCollapsed] = useState<Partial<Record<ModuleType, boolean>>>({});
  const [excelExporting, setExcelExporting] = useState(false);
  const [excelError, setExcelError] = useState('');

  const elevatorRange = useRangeSummary('elevator', startPeriod, endPeriod, visible && modules.includes('elevator'));
  const cleaningRange = useRangeSummary('cleaning', startPeriod, endPeriod, visible && modules.includes('cleaning'));
  const loading = elevatorRange.isLoading || cleaningRange.isLoading;
  const rangeValid = startPeriod <= endPeriod;

  const perModule: { module: ModuleType; data: RangePeriodSummary[] }[] = [
    { module: 'elevator' as ModuleType, data: elevatorRange.data ?? [] },
    { module: 'cleaning' as ModuleType, data: cleaningRange.data ?? [] },
  ].filter(e => modules.includes(e.module));

  const totals = perModule.reduce(
    (acc, m) => {
      for (const p of m.data) {
        acc.expected += p.total_expected;
        acc.collected += p.total_collected;
        acc.balance += p.total_balance;
      }
      return acc;
    },
    { expected: 0, collected: 0, balance: 0 },
  );

  // Excel için modül bazlı satırlar TEK bir "Dönem" satırında birleştirilir
  // — Excel'in bir sekmeden okunuşu, ekrandaki modül bazlı kırılımdan farklı
  // olarak Genel + Asansör + Temizlik'i yan yana ister (bkz. kullanıcı talebi:
  // "esnafın açtığında bir bakışta anlayacağı sadelik"). En eskiden en
  // yeniye sıralanır — bir yıllık dökümün doğal okuma sırası.
  //
  // ÖNEMLİ: satır listesi SADECE veritabanında kaydı olan (v_period_summary'de
  // satırı bulunan) dönemlerden değil, kullanıcının SEÇTİĞİ [startPeriod,
  // endPeriod] aralığındaki HER AYDAN üretilir (bkz. kullanıcı geri bildirimi:
  // "Şubat'ta veri yok diye Excel'de Şubat hiç görünmüyordu, seçtiğim aydan
  // itibaren görmek istiyorum — sıfırsa sıfır görünsün"). Veri olmayan bir ay
  // için o modülün 0/0/0 olarak görünmesi DOĞRU davranıştır.
  const excelRows: RangeExcelRow[] = useMemo(() => {
    if (!rangeValid) return [];
    const byPeriod = new Map<string, { elevator?: RangePeriodSummary; cleaning?: RangePeriodSummary }>();
    for (const p of elevatorRange.data ?? []) byPeriod.set(p.period, { ...byPeriod.get(p.period), elevator: p });
    for (const p of cleaningRange.data ?? []) byPeriod.set(p.period, { ...byPeriod.get(p.period), cleaning: p });

    const periods: string[] = [];
    for (let p = startPeriod; p <= endPeriod; p = shiftPeriod(p, 1)) periods.push(p);

    return periods.map(period => {
      const { elevator: el, cleaning: cl } = byPeriod.get(period) ?? {};
      const elevatorExpected = el?.total_expected ?? 0;
      const elevatorCollected = el?.total_collected ?? 0;
      const elevatorBalance = el?.total_balance ?? 0;
      const cleaningExpected = cl?.total_expected ?? 0;
      const cleaningCollected = cl?.total_collected ?? 0;
      const cleaningBalance = cl?.total_balance ?? 0;
      return {
        period,
        generalExpected: elevatorExpected + cleaningExpected,
        generalCollected: elevatorCollected + cleaningCollected,
        generalBalance: elevatorBalance + cleaningBalance,
        elevatorExpected, elevatorCollected, elevatorBalance,
        cleaningExpected, cleaningCollected, cleaningBalance,
      };
    });
  }, [elevatorRange.data, cleaningRange.data, startPeriod, endPeriod, rangeValid]);

  async function handleExportExcel() {
    if (excelExporting || excelRows.length === 0) return;
    setExcelExporting(true);
    setExcelError('');
    try {
      const fileName = `Yillik_Ozet_${periodFileLabel(startPeriod)}-${periodFileLabel(endPeriod)}`;
      await exportRangeSummaryExcel(excelRows, fileName);
    } catch (err) {
      setExcelError('Excel dışa aktarma başarısız oldu.');
    } finally {
      setExcelExporting(false);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} maxHeightRatio={0.85}>
          <View style={{
            padding: spacing.lg, gap: spacing.md, flexShrink: 0,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: glassColors.cardBorder,
          }}>
            {/* Baslik TEK BASINA kendi satirinda — uzun baslik ("Tarih Aralığı
                Bilançosu") + pil buton AYNI satirda basinca/dar ekranlarda
                garip sikisiyordu (bkz. kullanici geri bildirimi). Buton
                simdi ayri, sag hizali bir satirda. */}
            <Txt variant="h3" color={glassColors.textPrimary} numberOfLines={1}>Tarih Aralığı Bilançosu</Txt>
            <Pressable
              onPress={handleExportExcel}
              disabled={excelExporting || !rangeValid || excelRows.length === 0}
              hitSlop={8}
              android_ripple={androidRipple}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4,
                backgroundColor: c.accentSoft, borderRadius: radius.pill,
                paddingVertical: 6, paddingHorizontal: 12,
                opacity: (!rangeValid || excelRows.length === 0) ? 0.4 : pressed && Platform.OS === 'ios' ? 0.7 : 1,
              }, pressScaleStyle(pressed)]}
            >
              <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
                {excelExporting ? '…' : '📥 Excel'}
              </Txt>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="tiny" color={c.textFaint}>Başlangıç Ayı</Txt>
                <PeriodSwitcher period={startPeriod} onChange={setStartPeriod} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="tiny" color={c.textFaint}>Bitiş Ayı</Txt>
                <PeriodSwitcher period={endPeriod} onChange={setEndPeriod} />
              </View>
            </View>
            {!!excelError && <Txt variant="tiny" color={c.danger}>{excelError}</Txt>}
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            {...bounceScrollProps}
          >
            {!rangeValid ? (
              <Txt variant="small" color={c.danger}>Başlangıç ayı, bitiş ayından sonra olamaz.</Txt>
            ) : loading ? (
              <Txt variant="small" color={c.textFaint}>Hesaplanıyor…</Txt>
            ) : (
              <>
                <View style={{ gap: spacing.md }}>
                  <BigStat label="Toplam Beklenen" value={totals.expected} color={c.text} full />
                  <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                    <BigStat label="Tahsil Edilen" value={totals.collected} color={c.ok} />
                    <BigStat label="Kalan Alacak" value={totals.balance} color={c.danger} />
                  </View>
                </View>

                {perModule.map(m => {
                  const isCollapsed = collapsed[m.module] ?? false;
                  const moduleTotals = m.data.reduce(
                    (acc, p) => {
                      acc.expected += p.total_expected;
                      acc.collected += p.total_collected;
                      acc.balance += p.total_balance;
                      return acc;
                    },
                    { expected: 0, collected: 0, balance: 0 },
                  );

                  return (
                    <View key={m.module} style={{ gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassColors.cardBorder, paddingTop: spacing.md }}>
                      <Pressable
                        onPress={() => setCollapsed(prev => ({ ...prev, [m.module]: !isCollapsed }))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                      >
                        <View style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: dark ? moduleAccent[m.module].dark : moduleAccent[m.module].light,
                        }} />
                        <Txt variant="h3" style={{ flex: 1 }}>{MODULE_LABEL[m.module]}</Txt>
                        <Txt variant="tiny" color={c.textFaint}>({m.data.length} ay)</Txt>
                        <Txt variant="small" color={c.textFaint}>{isCollapsed ? '▾' : '▴'}</Txt>
                      </Pressable>

                      {/* Modul toplami OZET karti: alttaki tekil ay kartlarindan (bkz.
                          asagida) KESINLIKLE farkli gorunmeli — esnaf "bu bir aylik
                          kayit degil, genel toplam" diye bir bakista ayirt edebilsin.
                          Soft/pastel ton yerine (bkz. kullanici geri bildirimi: "renkler
                          hosuma gitmedi") DOLU, koyu marka rengi + beyaz yazi — Excel
                          disa aktarimindaki AYNI dil (bkz. kullanici onayi: "renkler
                          mukemmel"). moduleAccent[...].light KASITLI kullanilir: dark
                          teması içindeki .dark tonu (parlak/pastel, koyu zeminde METIN
                          icin tasarlandi) burada dolgu rengi olarak kullanilirsa beyaz
                          yaziyla kontrasti dusuk kalirdi. */}
                      {m.data.length > 0 && (
                        <View style={{
                          gap: spacing.xs,
                          backgroundColor: moduleAccent[m.module].light,
                          borderRadius: radius.md, padding: spacing.md,
                        }}>
                          <Txt variant="tiny" color="#FFFFFF" style={{ fontWeight: '800', letterSpacing: 0.5 }}>
                            📊 TOPLAM ÖZET · SEÇİLİ ARALIK
                          </Txt>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                            <BreakdownStat label="Toplam Beklenen" value={moduleTotals.expected} color="#FFFFFF" labelColor="rgba(255,255,255,0.75)" />
                            <BreakdownStat label="Toplam Tahsil" value={moduleTotals.collected} color="#FFFFFF" labelColor="rgba(255,255,255,0.75)" />
                            <BreakdownStat label="Kalan" value={moduleTotals.balance} color="#FFFFFF" labelColor="rgba(255,255,255,0.75)" />
                          </View>
                        </View>
                      )}

                      {!isCollapsed && (
                        m.data.length === 0 ? (
                          <Txt variant="tiny" color={c.textFaint}>Bu aralıkta veri yok.</Txt>
                        ) : m.data.map(p => (
                          <View key={p.period} style={{
                            gap: spacing.xs,
                            backgroundColor: 'transparent',
                            borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: spacing.md,
                          }}>
                            <Txt variant="small" color={c.textMuted} style={{ fontWeight: '700' }}>{periodLabel(p.period)}</Txt>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                              <BreakdownStat label="Beklenen" value={p.total_expected} color={c.textMuted} />
                              <BreakdownStat label="Tahsil" value={p.total_collected} color={c.ok} />
                              <BreakdownStat label="Kalan" value={p.total_balance} color={c.danger} />
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  viewToggle: {
    flexDirection: 'row', alignSelf: 'flex-start', gap: 2,
    backgroundColor: 'rgba(5,10,25,0.45)', borderRadius: 999, padding: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  viewToggleBtn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: 'transparent',
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(37,99,235,0.35)', borderColor: 'rgba(96,165,250,0.5)',
  },
  // Grafik + legend'i yan yana yerlestiren satir — bkz. kullanici geri
  // bildirimi: "legend grafigin altina degil, sagina tasinsin". Mobilde
  // (native) bu satir OLDUGU GIBI birakilir. Web'deki gercek sorun: GlassCard
  // icerigi varsayilan olarak (RN'in View alignItems:'stretch' varsayimi)
  // bu satiri karti KAPLAYACAK SEKILDE geniyor, legendCol'daki flex:1 de
  // kalan TUM bosluga yayiliyor — sonuc olarak justifyContent:'center' hicbir
  // sey yapamiyor cunku dagitilacak bos alan kalmiyor (pasta hep sol kosede,
  // legend sağdaki genis bosluga yayilmis goruyor — bkz. kullanici geri
  // bildirimi: "hala sol tarafa dayali"). Gercek cozum: web'de satirin
  // KENDISI icerigine gore boyutlansin (alignSelf:'center' ile stretch'i
  // gecersiz kilar) ve legendCol web'de flex:1 BUYUMESIN (asagida) — boylece
  // kompakt {pasta+legend} ikilisi kartin ortasinda gorunur.
  chartRow: Platform.OS === 'web'
    ? { flexDirection: 'row', alignItems: 'center', gap: 16, alignSelf: 'center', justifyContent: 'center' } as const
    : { flexDirection: 'row', alignItems: 'center', gap: 16 } as const,
  chartCenter: {
    alignItems: 'center', justifyContent: 'center', maxWidth: 100,
  },
  // PieChart'in kendi kutusuyla ayni boyuta sarilir; dilim bildirimi bu
  // sinirlar icinde ortalanarak asla karti/legend'i asıp gorunmez olmaz.
  chartWrap: {
    alignItems: 'center', justifyContent: 'center',
  },
  sliceTooltip: {
    position: 'absolute', top: 58, left: 0, right: 0,
    alignItems: 'center',
  },
  sliceTooltipBox: {
    maxWidth: 150, alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(11,21,38,0.96)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
  },
  sliceTooltipHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  // Native'de flex:1 (kalan alani doldurur, mobilde AYNI kalir). Web'de
  // flex:1 VERILMEZ — cunku chartRow artik icerige gore boyutlaniyor
  // (alignSelf:'center'), flex:1 burada legend'i gereksiz yere genisletip
  // pastayi yine sola iter (bkz. chartRow yorumu).
  legendCol: Platform.OS === 'web' ? { gap: 14 } as const : { flex: 1, gap: 14 } as const,
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  legendDot: {
    width: 10, height: 10, borderRadius: 5,
  },
});

function BigStat({ label, value, color, labelColor, full }: {
  label: string; value: number; color: string; labelColor?: string; full?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2, flex: full ? undefined : 1 }}>
      <Txt variant="small" color={labelColor ?? c.textFaint}>{label}</Txt>
      <Txt variant={full ? 'moneyLg' : 'moneyMd'} color={color} numberOfLines={1} style={glassTextShadow}>{money(value)}</Txt>
    </View>
  );
}

function BreakdownStat({ label, value, color, labelColor }: {
  label: string; value: number; color: string; labelColor?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <Txt variant="tiny" color={labelColor ?? c.textFaint}>{label}</Txt>
      <Txt variant="moneySm" color={color} style={glassTextShadow}>{money(value)}</Txt>
    </View>
  );
}
