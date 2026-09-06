import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useLedger, usePeriodSummary } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { currentPeriod, periodFileLabel, periodLabel } from '@/lib/format';
import { exportLedgerCsv } from '@/lib/export';
import {
  MODULE_FILE_LABEL, MODULE_LABEL, QUICK_FILTERS, matchesQuickFilter,
  type LedgerRow, type ModuleType, type QuickFilterKey,
} from '@/lib/types';
import { ConfirmModal, EmptyState, ErrorState, Loading, Toast, Txt } from '@/components/ui';
import { LedgerListItem, SummaryStrip } from '@/components/ledger';
import { FilterDropdown, PeriodSwitcher, SearchBar } from '@/components/pickers';
import { QuickEntryModal } from '@/components/QuickEntryModal';
import { AddSiteModal } from '@/components/AddSiteModal';

export default function LedgerListScreen() {
  const { module: raw } = useLocalSearchParams<{ module: string }>();
  const module = raw as ModuleType;
  const { modules, profile } = useAuth();
  const { c, spacing, radius } = useTheme();
  const navigation = useNavigation();
  const canManageSites = profile?.role === 'admin' || profile?.role === 'operator';

  const [period, setPeriod] = useState(currentPeriod());
  const [filter, setFilter] = useState<QuickFilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<LedgerRow | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' }>(
    { visible: false, message: '', variant: 'success' }
  );
  const [exporting, setExporting] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [addSiteOpen, setAddSiteOpen] = useState(false);

  const ledger = useLedger(module, period);
  const summary = usePeriodSummary(module, period);
  const hasRows = (ledger.data?.length ?? 0) > 0;

  async function handleExport() {
    const data = ledger.data ?? [];
    setExportConfirmOpen(false);
    if (exporting || data.length === 0) return;
    setExporting(true);
    try {
      const fileName = `${MODULE_FILE_LABEL[module] ?? 'Rapor'}_${periodFileLabel(period)}_Raporu`;
      await exportLedgerCsv(data, fileName);
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

  useEffect(() => {
    navigation.setOptions({
      title: MODULE_LABEL[module] ?? 'Aylık Takip',
      headerRight: () => (
        <Pressable
          onPress={() => setExportConfirmOpen(true)}
          disabled={exporting || !hasRows}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: c.accentSoft,
            borderRadius: radius.pill,
            paddingVertical: 6, paddingHorizontal: 12,
            opacity: !hasRows ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
            {exporting ? '…' : '⬇︎ Dışa Aktar'}
          </Txt>
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, module, exporting, hasRows, c.accent, c.accentSoft, radius.pill]);

  // Filtre secenegi basina kayit sayisi (dropdown'da gosterilir)
  const counts = useMemo(() => {
    const data = ledger.data ?? [];
    const out: Record<string, number> = {};
    for (const f of QUICK_FILTERS) {
      out[f.key] = f.key === 'all' ? data.length : data.filter(r => matchesQuickFilter(r, f.key)).length;
    }
    return out;
  }, [ledger.data]);

  const rows = useMemo(() => {
    const data = ledger.data ?? [];
    const byFilter = filter === 'all' ? data : data.filter(r => matchesQuickFilter(r, filter));
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return byFilter;
    return byFilter.filter(r =>
      r.site_name.toLocaleLowerCase('tr-TR').includes(q) ||
      r.site_code.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [ledger.data, filter, search]);

  if (!module || (modules.length > 0 && !modules.includes(module))) {
    return (
      <EmptyState
        title="Bu modüle erişiminiz yok"
        detail="Yetkileriniz bu modülü kapsamıyor. Sistem yöneticisiyle görüşün."
      />
    );
  }

  if (ledger.isError) {
    return <ErrorState message={(ledger.error as Error).message} onRetry={() => ledger.refetch()} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={r => r.ledger_id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
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
            <SummaryStrip summary={summary.data} />
            <SearchBar value={search} onChange={setSearch} />
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' }}>
              <View style={{ flex: 1 }}>
                <FilterDropdown
                  value={filter}
                  options={QUICK_FILTERS}
                  onChange={setFilter}
                  counts={counts as any}
                />
              </View>
              {canManageSites && (
                <Pressable
                  onPress={() => setAddSiteOpen(true)}
                  style={({ pressed }) => ({
                    alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: spacing.lg,
                    backgroundColor: c.accentSoft,
                    borderRadius: radius.md,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Txt variant="h3" color={c.accent} style={{ fontWeight: '700' }}>+ Ekle</Txt>
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <LedgerListItem row={item} onPress={setSelectedRow} />
        )}
        ListEmptyComponent={
          ledger.isLoading
            ? <Loading label="Liste hazırlanıyor…" />
            : <EmptyState
                title={search.trim() ? 'Aramayla eşleşen site yok' : filter === 'all' ? 'Bu dönemde kayıt yok' : 'Bu filtreye uyan kayıt yok'}
                detail={search.trim()
                  ? 'Farklı bir isim veya kod ile tekrar deneyin.'
                  : filter === 'all'
                    ? 'Aktif sitelerin bu ayki satırları otomatik açılır. Site tanımlıysa listede görünmeli.'
                    : 'Farklı bir durum seçerek listeyi genişletebilirsiniz.'}
              />
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <Txt variant="tiny" color={c.textFaint} style={{ textAlign: 'center', marginTop: spacing.md }}>
              {rows.length} kayıt · en son işlem gören üstte
            </Txt>
          ) : null
        }
      />

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
        onSiteUpdated={name => {
          setToast({ visible: true, variant: 'success', message: `${name} güncellendi.` });
        }}
        onNavigateToPeriod={handleNavigateToPeriod}
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
    </View>
  );
}
