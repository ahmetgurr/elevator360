/**
 * Liste verisini CSV olarak disari aktarma.
 * CSV secildi: Excel/Google Sheets ile dogrudan acilir, ekstra bir goruntuleyici
 * gerektirmez ve hem Web hem Android/iOS uzerinde Expo ile sorunsuz calisir.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { num, periodLabel, periodShortLabel } from './format';
import type { CarriedOverBreakdownEntry } from './api';
import type { LedgerRow, PeriodSummary } from './types';

const CSV_HEADER = [
  'Site Adı', 'Site Kodu',
  'Aylık Ücret', 'Ekstra', 'Bu Ayki Toplam Tutar', 'Ödenen', 'Bu Aydan Kalan Bakiye',
  'Önceki Aylardan Devreden Toplam Borç', 'Tüm Devreden Tutardan Geriye Kalan Toplam Borç',
  'Vade Tarihi', 'Gecikme Günü (Gün)', 'Notlar', 'Geçmiş Borç Analizi / Hatırlatma',
];

function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "06.2026'dan 4.000₺, 07.2026'dan 2.000₺ borcu bulunmaktadır." */
function buildDebtReminder(breakdown: CarriedOverBreakdownEntry[]): string {
  if (breakdown.length === 0) return '';
  const parts = breakdown.map(b => `${periodShortLabel(b.period)}'dan ${Math.round(b.balance).toLocaleString('tr-TR')}₺`);
  return `${parts.join(', ')} borcu bulunmaktadır.`;
}

function buildCsv(
  rows: LedgerRow[],
  period: string,
  summary: PeriodSummary | null,
  carriedOverBreakdown: Record<string, CarriedOverBreakdownEntry[]>,
): string {
  const lines = [CSV_HEADER.map(csvField).join(';')];

  for (const r of rows) {
    const carried = num(r.carried_over_balance);
    const thisBalance = num(r.balance);
    const remainingTotal = Math.max(carried + thisBalance, 0);
    const breakdown = carriedOverBreakdown[r.site_id] ?? [];

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
      buildDebtReminder(breakdown),
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
    lines.push(['Gecikmiş', String(summary.overdue_count)].map(csvField).join(';'));
  }

  // Basta BOM: Excel'in Turkce karakterleri (ş, ı, ğ...) dogru okumasi icin
  return '﻿' + lines.join('\r\n');
}

/** Verilen kayitlari CSV'ye cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportLedgerCsv(
  rows: LedgerRow[],
  fileNameBase: string,
  options: {
    period: string;
    summary: PeriodSummary | null;
    carriedOverBreakdown: Record<string, CarriedOverBreakdownEntry[]>;
  },
): Promise<void> {
  const csv = buildCsv(rows, options.period, options.summary, options.carriedOverBreakdown);
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
