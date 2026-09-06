/**
 * Liste verisini CSV olarak disari aktarma.
 * CSV secildi: Excel/Google Sheets ile dogrudan acilir, ekstra bir goruntuleyici
 * gerektirmez ve hem Web hem Android/iOS uzerinde Expo ile sorunsuz calisir.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { money, num, periodLabel } from './format';
import { finalBalanceState, type LedgerRow, type PeriodSummary } from './types';

const CSV_HEADER = [
  'Site Adı', 'Site Kodu',
  'Aylık Ücret', 'Ekstra', 'Bu Ayki Toplam Tutar', 'Ödenen', 'Bu Aydan Kalan Bakiye',
  'Önceki Aylardan Devreden Toplam Borç', 'Tüm Devreden Tutardan Geriye Kalan Toplam Borç',
  'Vade Tarihi', 'Gecikme Günü (Gün)', 'Notlar',
];

function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows: LedgerRow[], period: string, summary: PeriodSummary | null): string {
  const lines = [CSV_HEADER.map(csvField).join(';')];

  for (const r of rows) {
    const carried = num(r.carried_over_balance);
    const thisBalance = num(r.balance);
    const remainingTotal = Math.max(carried + thisBalance, 0);

    lines.push([
      r.site_name, r.site_code,
      num(r.base_fee).toFixed(2),
      num(r.extra_total).toFixed(2),
      num(r.total_due).toFixed(2),
      num(r.net_paid).toFixed(2),
      thisBalance.toFixed(2),
      carried.toFixed(2),
      remainingTotal.toFixed(2),
      r.due_date ?? '',
      String(r.days_overdue ?? 0),
      r.site_notes ?? '',
    ].map(csvField).join(';'));
  }

  // Excel'de oldugu gibi: en sonda o ayin aylik bilanço ozeti
  lines.push('');
  lines.push(csvField(`AYLIK BİLANÇO — ${periodLabel(period)}`));
  if (summary) {
    lines.push(['Toplam Beklenen', num(summary.total_expected).toFixed(2)].map(csvField).join(';'));
    lines.push(['Tahsil Edilen', num(summary.total_collected).toFixed(2)].map(csvField).join(';'));
    lines.push(['Kalan Alacak', num(summary.total_balance).toFixed(2)].map(csvField).join(';'));
    lines.push(['Tahsilat Oranı (%)', num(summary.collection_rate_pct).toFixed(2)].map(csvField).join(';'));
    lines.push(['Site Sayısı', String(summary.site_count)].map(csvField).join(';'));
    lines.push(['Tamamlanan', String(summary.completed_count)].map(csvField).join(';'));
    lines.push(['Kısmi Ödeme', String(summary.partial_count)].map(csvField).join(';'));
    lines.push(['Bekliyor', String(summary.pending_count)].map(csvField).join(';'));
    lines.push(['Gecikmiş', String(summary.overdue_count)].map(csvField).join(';'));
  }

  return finishCsv(lines);
}

const SITE_STATEMENT_HEADER = [
  'Ay/Dönem', 'Aylık Ücret', 'Ekstra', 'Toplam Tahakkuk (Beklenen)', 'Ödenen', 'Kalan Bakiye',
];

/** Siteye ozel cari ekstre CSV'si — donemler eskiden yeniye, en altta nihai ozet analizi. */
function buildSiteStatementCsv(rows: LedgerRow[], siteName: string): string {
  const ordered = [...rows].sort((a, b) => a.period.localeCompare(b.period));
  const lines = [csvField(`Cari Ekstre — ${siteName}`), '', SITE_STATEMENT_HEADER.map(csvField).join(';')];

  let totalExpected = 0;
  let totalPaid = 0;
  for (const r of ordered) {
    totalExpected += num(r.total_due);
    totalPaid += num(r.net_paid);
    lines.push([
      periodLabel(r.period),
      num(r.base_fee).toFixed(2),
      num(r.extra_total).toFixed(2),
      num(r.total_due).toFixed(2),
      num(r.net_paid).toFixed(2),
      num(r.balance).toFixed(2),
    ].map(csvField).join(';'));
  }

  const finalState = finalBalanceState(num(ordered[ordered.length - 1]?.site_current_balance ?? '0'));
  const finalLabel = finalState.kind === 'debt'
    ? `${money(finalState.amount)} (Borçlu)`
    : finalState.kind === 'credit'
      ? `${money(finalState.amount)} (Alacaklı)`
      : 'Sıfırlandı / Borcu Yok';

  lines.push('');
  lines.push(['TÜM ZAMANLAR TOPLAM BEKLENEN', totalExpected.toFixed(2)].map(csvField).join(';'));
  lines.push(['TOPLAM ÖDENEN', totalPaid.toFixed(2)].map(csvField).join(';'));
  lines.push(['NİHAİ KALAN BORÇ/BAKİYE', csvField(finalLabel)].join(';'));

  return finishCsv(lines);
}

/** Basta BOM: Excel'in Turkce karakterleri (ş, ı, ğ...) dogru okumasi icin */
function finishCsv(lines: string[]): string {
  return '﻿' + lines.join('\r\n');
}

/** Verilen CSV metnini indirir (Web) ya da paylasim menusune acar (native). */
async function downloadCsv(csv: string, fileNameBase: string): Promise<void> {
  const fileName = `${fileNameBase}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: fileNameBase,
      UTI: 'public.comma-separated-values-text',
    });
  }
}

/** Verilen kayitlari CSV'ye cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportLedgerCsv(
  rows: LedgerRow[],
  fileNameBase: string,
  options: { period: string; summary: PeriodSummary | null },
): Promise<void> {
  await downloadCsv(buildCsv(rows, options.period, options.summary), fileNameBase);
}

/** Siteye ozel cari ekstreyi CSV'ye cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportSiteStatementCsv(rows: LedgerRow[], siteName: string, fileNameBase: string): Promise<void> {
  await downloadCsv(buildSiteStatementCsv(rows, siteName), fileNameBase);
}
