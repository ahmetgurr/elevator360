import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  useLedger, usePeriodSummary, useProjectedSites, useProjectedSummary,
  type ProjectedSite,
} from '@/lib/api';
import { ModuleThemeProvider, glassColors, useTheme } from '@/lib/theme';
import { currentPeriod, isFuturePeriod, periodFileLabel, periodLabel } from '@/lib/format';
import { exportLedgerCsv } from '@/lib/export';
import {
  MODULE_FILE_LABEL, MODULE_LABEL, QUICK_FILTERS, SORT_OPTIONS, matchesQuickFilter, sortLedgerRows,
  type LedgerRow, type ModuleType, type QuickFilterKey, type SortKey,
} from '@/lib/types';
import { ConfirmModal, EmptyState, ErrorState, Loading, Toast, Txt } from '@/components/ui';
import { LedgerListItem, ProjectedSiteListItem, ProjectedSummaryCard, SummaryStrip } from '@/components/ledger';
import { FilterDropdown, PeriodSwitcher, SearchBar } from '@/components/pickers';
import { QuickEntryModal, SiteStatementModal } from '@/components/QuickEntryModal';
import { AddSiteModal } from '@/components/AddSiteModal';
import { EditSiteModal } from '@/components/EditSiteModal';
import { GlassBackground } from '@/components/Glass';

type ListItem = LedgerRow | ProjectedSite;

/** Ozel (native olmayan) header'in sabit icerik yuksekligi — bkz. collapsible header. */
const HEADER_CONTENT_HEIGHT = 56;

function LedgerListScreenInner({ module }: { module: ModuleType }) {
  const { modules, profile } = useAuth();
  const { c, spacing, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const totalHeaderHeight = insets.top + HEADER_CONTENT_HEIGHT;
  const canManageSites = profile?.role === 'admin' || profile?.role === 'operator';

  /**
   * Kaydirmali (collapsible) header: Animated.diffClamp, altta yatan
   * scrollY'nin DELTASINI 0..totalHeaderHeight araliginda kirpar — asagi
   * kaydirinca artar (header gizlenir), yukari kaydirinca AZALIR (header
   * geri gelir), mutlak kaydirma konumundan BAGIMSIZ calisir (bkz.
   * kullanici geri bildirimi: "asagi kaydiirinca gizlensin, yukari
   * kaydirinca geri gelsin"). useNativeDriver:true ile transform bazli
   * oldugu icin JS thread'i bloke etmez.
   */
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = Animated.diffClamp(scrollY, 0, totalHeaderHeight).interpolate({
    inputRange: [0, totalHeaderHeight],
    outputRange: [0, -totalHeaderHeight],
    extrapolate: 'clamp',
  });
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const [period, setPeriod] = useState(currentPeriod());
  const [filter, setFilter] = useState<QuickFilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<LedgerRow | null>(null);
  const [selectedProjectedSiteId, setSelectedProjectedSiteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' }>(
    { visible: false, message: '', variant: 'success' }
  );
  const [exporting, setExporting] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [statement, setStatement] = useState<{ siteName: string; currentRow: LedgerRow; historyRows: LedgerRow[] } | null>(null);

  const ledger = useLedger(module, period);
  const summary = usePeriodSummary(module, period);
  const future = isFuturePeriod(period);
  // Icinde bulunulan ay da dahil: bugune kadar acilmis olmasi GEREKEN ama
  // henuz acilmamis siteler icin de "oncelenen" kart gosterilebilsin.
  const isCurrentOrFuture = period >= currentPeriod();
  const projectedSummary = useProjectedSummary(module, period, future);
  const projectedSites = useProjectedSites(module, period, isCurrentOrFuture);
  const hasRows = (ledger.data?.length ?? 0) > 0;

  async function handleExport() {
    const data = ledger.data ?? [];
    setExportConfirmOpen(false);
    if (exporting || data.length === 0) return;
    setExporting(true);
    try {
      const fileName = `${MODULE_FILE_LABEL[module] ?? 'Rapor'}_${periodFileLabel(period)}_Raporu`;
      await exportLedgerCsv(data, fileName, { period, summary: summary.data ?? null });
      setToast({ visible: true, variant: 'success', message: 'CSV raporu hazırlandı.' });
    } catch (err) {
      setToast({ visible: true, variant: 'error', message: 'Dışa aktarma başarısız oldu.' });
    } finally {
      setExporting(false);
    }
  }

  function handleNavigateToPeriod(targetPeriod: string, targetRow: LedgerRow) {
    setPeriod(targetPeriod);
    setSelectedRow(targetRow);
  }

  const rows = useMemo(() => {
    const data = ledger.data ?? [];
    const byFilter = data.filter(r => matchesQuickFilter(r, filter));
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const bySearch = !q ? byFilter : byFilter.filter(r =>
      r.site_name.toLocaleLowerCase('tr-TR').includes(q) ||
      r.site_code.toLocaleLowerCase('tr-TR').includes(q)
    );
    return sortLedgerRows(bySearch, sortKey);
  }, [ledger.data, filter, search, sortKey]);

  /**
   * Yari dolu aylarin harmanlanmasi: bu donem icin HENUZ gercek ledger
   * satiri olmayan aktif siteler, gercek kayitlarla AYNI listede silik
   * "Öngörülen" kart olarak gösterilir (bkz. ProjectedSiteListItem).
   * Sadece durum filtresi 'all' iken gosterilir — durum filtreleri
   * (odendi/odenmedi/gecikti) projeksiyonlar icin anlamli degildir.
   */
  const missingProjected = useMemo(() => {
    if (!isCurrentOrFuture || filter !== 'all') return [];
    const realSiteIds = new Set((ledger.data ?? []).map(r => r.site_id));
    const data = (projectedSites.data ?? []).filter(s => !realSiteIds.has(s.site_id));
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return data;
    return data.filter(s =>
      s.site_name.toLocaleLowerCase('tr-TR').includes(q) ||
      s.site_code.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [projectedSites.data, ledger.data, isCurrentOrFuture, filter, search]);

  /**
   * Pasif (sozlesmesi feshedilmis) siteler "Tumu" disindaki hicbir filtrede
   * gorunmez; "Tumu" secildiğinde ise aktif site sayisina/siralamaya KARIŞMADAN
   * listenin EN ALTINA, soluk/pasif tasarimiyla (LedgerListItem zaten
   * !isActive satirlari boyle gosteriyor) iliştirilir (bkz. kullanici geri
   * bildirimi). Bu yuzden 'rows'/'counts' hesaplarindan tamamen ayri tutulur.
   */
  const passiveRows = useMemo(() => {
    if (filter !== 'all') return [];
    const data = (ledger.data ?? []).filter(r => matchesQuickFilter(r, 'passive'));
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const bySearch = !q ? data : data.filter(r =>
      r.site_name.toLocaleLowerCase('tr-TR').includes(q) ||
      r.site_code.toLocaleLowerCase('tr-TR').includes(q)
    );
    return sortLedgerRows(bySearch, sortKey);
  }, [ledger.data, filter, search, sortKey]);

  // Filtre secenegi basina site sayisi (dropdown'da gosterilir). 'all' icin
  // sadece gercek satirlar degil, henuz acilmamis (oncelenen) aktif siteler
  // de sayilir — esnaf "Tumu"nde TOPLAM aktif site sayisini gormek istiyor
  // (bkz. kullanici geri bildirimi). Pasif siteler bu sayima KESINLIKLE dahil
  // edilmez (ayrica 'passive' anahtari zaten kendi gercek sayisini tasir).
  const counts = useMemo(() => {
    const data = ledger.data ?? [];
    const out: Record<string, number> = {};
    for (const f of QUICK_FILTERS) {
      out[f.key] = data.filter(r => matchesQuickFilter(r, f.key)).length;
    }
    out.all += missingProjected.length;
    return out;
  }, [ledger.data, missingProjected]);

  /**
   * Alfabetik siralama, sadece gercek satirlari degil EKRANDA GORUNEN tum
   * aktif harmani (gercek + oncelenen) uzerinden calismali (bkz. kullanici
   * geri bildirimi) — bu yuzden 'rows' zaten kendi icinde sirali olsa da,
   * alfabetik anahtarlarda iki grup BIRLIKTE yeniden siralanir. Diger
   * siralama anahtarlari (vade/odeme durumu) oncelenen kartlar icin anlamli
   * veri tasimadigindan onlar icin oncelenenler sondaki sirada kalir.
   */
  const activeBlend: ListItem[] = useMemo(() => {
    const combined: ListItem[] = [...rows, ...missingProjected];
    if (sortKey === 'alpha_asc') return [...combined].sort((a, b) => a.site_name.localeCompare(b.site_name, 'tr'));
    if (sortKey === 'alpha_desc') return [...combined].sort((a, b) => b.site_name.localeCompare(a.site_name, 'tr'));
    return combined;
  }, [rows, missingProjected, sortKey]);

  const listData: ListItem[] = [...activeBlend, ...passiveRows];
  const accessDenied = !module || (modules.length > 0 && !modules.includes(module));
  const hasError = ledger.isError;

  return (
    <GlassBackground safeArea={false}>
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top, height: totalHeaderHeight, transform: [{ translateY: headerTranslateY }] },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerIconBtn}>
            <Txt variant="h2" color={glassColors.textPrimary}>‹</Txt>
          </Pressable>
          <Txt variant="h3" color={glassColors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
            {MODULE_LABEL[module] ?? 'Aylık Takip'}
          </Txt>
          {!accessDenied && !hasError && (
            <Pressable
              onPress={() => setExportConfirmOpen(true)}
              disabled={exporting || !hasRows}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: glassColors.cardBg,
                borderWidth: 1, borderColor: glassColors.cardBorder,
                borderRadius: radius.pill,
                paddingVertical: 6, paddingHorizontal: 12,
                opacity: !hasRows ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Txt variant="small" color={glassColors.textPrimary} style={{ fontWeight: '700' }}>
                {exporting ? '…' : '⬇︎ Dışa Aktar'}
              </Txt>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {accessDenied ? (
        <View style={{ flex: 1, paddingTop: totalHeaderHeight }}>
          <EmptyState
            title="Bu modüle erişiminiz yok"
            detail="Yetkileriniz bu modülü kapsamıyor. Sistem yöneticisiyle görüşün."
          />
        </View>
      ) : hasError ? (
        <View style={{ flex: 1, paddingTop: totalHeaderHeight }}>
          <ErrorState message={(ledger.error as Error).message} onRetry={() => ledger.refetch()} />
        </View>
      ) : (
      <Animated.FlatList<ListItem>
        data={listData}
        keyExtractor={item => 'ledger_id' in item ? item.ledger_id : item.site_id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: totalHeaderHeight + spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={ledger.isRefetching}
            onRefresh={() => { ledger.refetch(); summary.refetch(); }}
            tintColor={c.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.xs }}>
            <PeriodSwitcher period={period} onChange={setPeriod} />
            {future ? (
              // Gelecek bir donemde -- sitelerden bazilari icin (ornek: erken
              // girilmis bir ekstra) simdiden gercek satir acilmis olsa bile
              // -- ozet HER ZAMAN oncelenen (tum aktif siteler) formatinda
              // gosterilir; aksi halde sadece o birkac satirin kismi verisi
              // yanlislikla "bu ayin gercek ozeti" gibi gorunur (bkz.
              // kullanici geri bildirimi: Ekim'de "1 site" yazmasi).
              <ProjectedSummaryCard
                siteCount={projectedSummary.data?.site_count ?? 0}
                totalExpected={projectedSummary.data?.total_expected ?? 0}
              />
            ) : summary.data ? (
              <SummaryStrip summary={summary.data} />
            ) : null}
            <SearchBar value={search} onChange={setSearch} />
            {missingProjected.length > 0 && (
              <Txt variant="tiny" color={c.textFaint}>
                Silik/kesikli kenarlı kartlar henüz gerçek kaydı açılmamış (öngörülen) siteleri gösterir.
              </Txt>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'stretch' }}>
              <View style={{ flex: 1 }}>
                <FilterDropdown
                  value={filter}
                  options={QUICK_FILTERS}
                  onChange={setFilter}
                  counts={counts as any}
                />
              </View>
              <FilterDropdown
                value={sortKey}
                options={SORT_OPTIONS}
                onChange={setSortKey}
                compact={{ icon: '⇅', label: 'Sırala' }}
                title="Sırala"
              />
              {canManageSites && (
                <Pressable
                  onPress={() => setAddSiteOpen(true)}
                  style={({ pressed }) => ({
                    alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                    backgroundColor: c.accentSoft,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>+ Site Ekle</Txt>
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          'ledger_id' in item
            ? <LedgerListItem row={item} onPress={setSelectedRow} />
            : <ProjectedSiteListItem site={item} onPress={s => setSelectedProjectedSiteId(s.site_id)} />
        )}
        ListEmptyComponent={
          ledger.isLoading || (isCurrentOrFuture && projectedSites.isLoading)
            ? <Loading label="Liste hazırlanıyor…" />
            : <EmptyState
                title={search.trim() ? 'Aramayla eşleşen site yok' : filter === 'all' ? 'Bu dönemde aktif site yok' : 'Bu filtreye uyan kayıt yok'}
                detail={search.trim()
                  ? 'Farklı bir isim veya kod ile tekrar deneyin.'
                  : filter === 'all'
                    ? 'Aktif sitelerin bu ayki satırları otomatik açılır. Site tanımlıysa listede görünmeli.'
                    : 'Farklı bir durum seçerek listeyi genişletebilirsiniz.'}
              />
        }
        ListFooterComponent={
          listData.length > 0 ? (
            <Txt variant="tiny" color={c.textFaint} style={{ textAlign: 'center', marginTop: spacing.md }}>
              {missingProjected.length > 0 || passiveRows.length > 0
                ? [
                    `${rows.length} site`,
                    missingProjected.length > 0 ? `${missingProjected.length} öngörülen` : null,
                    passiveRows.length > 0 ? `${passiveRows.length} pasif` : null,
                  ].filter(Boolean).join(' + ') + ' · en son işlem gören üstte'
                : `${listData.length} site · en son işlem gören üstte`}
            </Txt>
          ) : null
        }
      />
      )}

      <QuickEntryModal
        row={selectedRow}
        module={module}
        period={period}
        canEdit={canManageSites}
        onClose={() => setSelectedRow(null)}
        onSuccess={row => {
          setSelectedRow(null);
          setToast({ visible: true, variant: 'success', message: `${row.site_name} için işlem başarıyla kaydedildi.` });
        }}
        onSiteUpdated={message => {
          setToast({ visible: true, variant: 'success', message });
        }}
        onNavigateToPeriod={handleNavigateToPeriod}
        onOpenStatement={(siteName, currentRow, historyRows) => setStatement({ siteName, currentRow, historyRows })}
      />

      <SiteStatementModal
        visible={!!statement}
        siteName={statement?.siteName ?? ''}
        currentRow={statement?.currentRow ?? null}
        historyRows={statement?.historyRows ?? []}
        onClose={() => setStatement(null)}
      />

      <EditSiteModal
        visible={!!selectedProjectedSiteId}
        siteId={selectedProjectedSiteId ?? undefined}
        module={module}
        period={period}
        onClose={() => setSelectedProjectedSiteId(null)}
        onSuccess={message => {
          setSelectedProjectedSiteId(null);
          setToast({ visible: true, variant: 'success', message });
        }}
      />

      <AddSiteModal
        visible={addSiteOpen}
        module={module}
        onClose={() => setAddSiteOpen(false)}
        onSuccess={site => {
          setAddSiteOpen(false);
          setToast({ visible: true, variant: 'success', message: `${site.name} sisteme eklendi.` });
        }}
      />

      <ConfirmModal
        visible={exportConfirmOpen}
        title="Dışa Aktarılsın mı?"
        message={`${periodLabel(period)} verilerini dışa aktarmak istiyor musunuz?`}
        confirmLabel="Dışa Aktar"
        onConfirm={handleExport}
        onCancel={() => setExportConfirmOpen(false)}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
    </GlassBackground>
  );
}

export default function LedgerListScreen() {
  const { module: raw } = useLocalSearchParams<{ module: string }>();
  const module = raw as ModuleType;
  return (
    <ModuleThemeProvider module={module}>
      <LedgerListScreenInner module={module} />
    </ModuleThemeProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    justifyContent: 'flex-end',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: HEADER_CONTENT_HEIGHT,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
});
