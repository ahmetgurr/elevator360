/**
 * Liste verisini CSV olarak disari aktarma.
 * CSV secildi: Excel/Google Sheets ile dogrudan acilir, ekstra bir goruntuleyici
 * gerektirmez ve hem Web hem Android/iOS uzerinde Expo ile sorunsuz calisir.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSXStyle from 'xlsx-js-style';
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

/* ------------------------------------------------------------------ */
/* "Tüm Yılı Göster" — esnaf dostu Excel (.xlsx) çıktısı                */
/* ------------------------------------------------------------------ */

export interface RangeExcelRow {
  period: string;
  generalExpected: number;
  generalCollected: number;
  generalBalance: number;
  elevatorExpected: number;
  elevatorCollected: number;
  elevatorBalance: number;
  cleaningExpected: number;
  cleaningCollected: number;
  cleaningBalance: number;
}

const EXCEL_HEADER = [
  'Dönem (Ay-Yıl)',
  'Genel Beklenen', 'Genel Tahsilat', 'Genel Kalan',
  'Asansör Beklenen', 'Asansör Tahsilat', 'Asansör Kalan',
  'Temizlik Beklenen', 'Temizlik Tahsilat', 'Temizlik Kalan',
];

/** Excel'in KENDI locale ayarina gore (TR ise) "1.500,00 ₺" olarak gorunur — kod evrensel, ayirac Excel'den gelir. */
const EXCEL_MONEY_FORMAT = '#,##0.00" ₺"';

/**
 * Her kolon grubu (Dönem / Genel / Asansör / Temizlik) esnafin tek bakista
 * ayirt edebilmesi icin AYRI bir renkle isaretlenir (bkz. kullanici talebi:
 * "üçünü de ayrı renklerde yaparsan ayırt etmek için güzel olur"). Asansör
 * ve Temizlik renkleri, uygulamanin kendi marka renkleriyle (bkz.
 * theme.ts -> moduleAccent / palette.icyBlue600 ve palette.teal600) BİREBİR
 * ESLESIR — Excel'i acan esnaf, uygulamadaki modul renklerini tanir.
 */
const GROUP_COLORS = {
  period:   { header: '0B1526', soft: 'E7ECF3' }, // navy900 (uygulamanin koyu lacivert kimligi)
  general:  { header: '1E293B', soft: 'E9EDF3' }, // notr koyu gri-lacivert — ne mavi ne yesil, "toplam" hissi
  elevator: { header: '2C5AA0', soft: 'DCEAFD' }, // icyBlue600 / icyBlue100 — Asansör modulunun rengi
  cleaning: { header: '0F9488', soft: 'CCFBF1' }, // teal600 / teal100 — Temizlik modulunun rengi
} as const;

/** Kolon index'i (0-based) -> hangi renk grubuna ait oldugu */
const COLUMN_GROUP: (keyof typeof GROUP_COLORS)[] = [
  'period',
  'general', 'general', 'general',
  'elevator', 'elevator', 'elevator',
  'cleaning', 'cleaning', 'cleaning',
];

function headerCellStyle(group: keyof typeof GROUP_COLORS) {
  return {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${GROUP_COLORS[group].header}` } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
}

function dataCellStyle(group: keyof typeof GROUP_COLORS) {
  return {
    font: { color: { rgb: 'FF1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${GROUP_COLORS[group].soft}` } },
  };
}

/** Alt toplam satiri: grup rengiyle AYNI (koyu) zemin + beyaz kalin yazi — bir bakista "bu bir toplam satırı" belli olsun. */
function totalCellStyle(group: keyof typeof GROUP_COLORS) {
  return {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${GROUP_COLORS[group].header}` } },
    border: { top: { style: 'medium', color: { rgb: 'FFFFFFFF' } } },
  };
}

/**
 * Esnafin acinca tek bakista anlayacagi, karmasik id'ler icermeyen sade
 * bir Excel tablosu: Ay-Yil basina tek satir, Genel + Asansor + Temizlik
 * kirilimi yan yana, her grup KENDI rengiyle. Rakamlar GERCEK sayi
 * (Excel'de toplanabilir/formul yazilabilir) olarak yazilir; gorunum
 * finansal formatla (₺, binlik/ondalik ayirac Excel'in kendi locale'inden)
 * saglanir. En altta secili tarih araligi icin KUMULATIF TOPLAM satiri
 * bulunur (bkz. kullanici talebi: "Mart-Eylül arası genel beklenen toplamı").
 */
function buildRangeExcelWorkbook(rows: RangeExcelRow[]) {
  const totals = rows.reduce(
    (acc, r) => ({
      generalExpected: acc.generalExpected + r.generalExpected,
      generalCollected: acc.generalCollected + r.generalCollected,
      generalBalance: acc.generalBalance + r.generalBalance,
      elevatorExpected: acc.elevatorExpected + r.elevatorExpected,
      elevatorCollected: acc.elevatorCollected + r.elevatorCollected,
      elevatorBalance: acc.elevatorBalance + r.elevatorBalance,
      cleaningExpected: acc.cleaningExpected + r.cleaningExpected,
      cleaningCollected: acc.cleaningCollected + r.cleaningCollected,
      cleaningBalance: acc.cleaningBalance + r.cleaningBalance,
    }),
    {
      generalExpected: 0, generalCollected: 0, generalBalance: 0,
      elevatorExpected: 0, elevatorCollected: 0, elevatorBalance: 0,
      cleaningExpected: 0, cleaningCollected: 0, cleaningBalance: 0,
    },
  );

  const totalsRowIndex = rows.length + 1; // 0: baslik, 1..rows.length: veri, sonraki: toplam
  const aoa: (string | number)[][] = [
    EXCEL_HEADER,
    ...rows.map(r => [
      periodLabel(r.period),
      r.generalExpected, r.generalCollected, r.generalBalance,
      r.elevatorExpected, r.elevatorCollected, r.elevatorBalance,
      r.cleaningExpected, r.cleaningCollected, r.cleaningBalance,
    ]),
    [
      'TOPLAM',
      totals.generalExpected, totals.generalCollected, totals.generalBalance,
      totals.elevatorExpected, totals.elevatorCollected, totals.elevatorBalance,
      totals.cleaningExpected, totals.cleaningCollected, totals.cleaningBalance,
    ],
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  for (let col = 0; col < EXCEL_HEADER.length; col++) {
    const group = COLUMN_GROUP[col];
    const headerAddr = XLSXStyle.utils.encode_cell({ r: 0, c: col });
    if (ws[headerAddr]) ws[headerAddr].s = headerCellStyle(group);

    for (let row = 1; row <= rows.length; row++) {
      const addr = XLSXStyle.utils.encode_cell({ r: row, c: col });
      if (!ws[addr]) continue;
      if (col > 0) ws[addr].z = EXCEL_MONEY_FORMAT;
      ws[addr].s = dataCellStyle(group);
    }

    const totalAddr = XLSXStyle.utils.encode_cell({ r: totalsRowIndex, c: col });
    if (ws[totalAddr]) {
      if (col > 0) ws[totalAddr].z = EXCEL_MONEY_FORMAT;
      ws[totalAddr].s = totalCellStyle(group);
    }
  }

  ws['!cols'] = [{ wch: 14 }, ...Array(9).fill({ wch: 17 })];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Yıllık Özet');
  return wb;
}

/** Verilen workbook'u indirir (Web) ya da paylasim menusune acar (native). */
async function downloadWorkbook(wb: ReturnType<typeof XLSXStyle.utils.book_new>, fileNameBase: string): Promise<void> {
  const fileName = `${fileNameBase}.xlsx`;
  const out = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayLike<number>;
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as unknown as BlobPart], { type: `${mimeType};charset=utf-8;` });
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
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: fileNameBase,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}

/** "Tüm Yılı Göster" pop-up'ındaki seçili [Başlangıç Ayı, Bitiş Ayı] aralığını Excel'e (.xlsx) aktarır. */
export async function exportRangeSummaryExcel(rows: RangeExcelRow[], fileNameBase: string): Promise<void> {
  await downloadWorkbook(buildRangeExcelWorkbook(rows), fileNameBase);
}
