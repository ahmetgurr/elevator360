/**
 * Liste verisini CSV olarak disari aktarma.
 * CSV secildi: Excel/Google Sheets ile dogrudan acilir, ekstra bir goruntuleyici
 * gerektirmez ve hem Web hem Android/iOS uzerinde Expo ile sorunsuz calisir.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { num } from './format';
import type { LedgerRow } from './types';

const CSV_HEADER = [
  'Site Adı', 'Site Kodu', 'Toplam Tutar', 'Ödenen', 'Kalan Bakiye',
  'Ekstra', 'İndirim', 'Durum', 'Vade Tarihi', 'Gecikme (Gün)',
];

function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(rows: LedgerRow[]): string {
  const lines = [CSV_HEADER.map(csvField).join(';')];
  for (const r of rows) {
    lines.push([
      r.site_name, r.site_code,
      num(r.total_due).toFixed(2), num(r.net_paid).toFixed(2), num(r.balance).toFixed(2),
      num(r.extra_total).toFixed(2), num(r.discount_total).toFixed(2),
      r.status_label, r.due_date ?? '', String(r.days_overdue ?? 0),
    ].map(csvField).join(';'));
  }
  // Basta BOM: Excel'in Turkce karakterleri (ş, ı, ğ...) dogru okumasi icin
  return '﻿' + lines.join('\r\n');
}

/** Verilen kayitlari CSV'ye cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportLedgerCsv(rows: LedgerRow[], fileNameBase: string): Promise<void> {
  const csv = buildCsv(rows);
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
