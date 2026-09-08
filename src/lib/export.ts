/**
 * Disa aktarma: tum raporlar stilli Excel (.xlsx) olarak uretilir —
 * "Tüm Yılı Göster" (yıllık özet) icin gelistirilen tasarim dili (renkli
 * baslik bantlari, gruplu renkler, finansal sayi formati) diger TUM
 * raporlara da uygulanir (bkz. kullanici talebi: "diğer excelde yaptığın
 * tasarımı beğenmiştim, burada da uygulayabilirsin").
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSXStyle from 'xlsx-js-style';
import { dateLabel, money, num, periodLabel } from './format';
import { finalBalanceState, type LedgerRow, type ModuleType, type PeriodSummary } from './types';

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

/** Uygulamanin kendi durum renkleriyle (theme.ts light.danger/dangerSoft, light.ok/okSoft) BİREBİR ESLESEN hucre renkleri. */
const STATUS_COLORS = {
  danger: { fg: 'B91C1C', bg: 'FEE2E2' }, // palette.red600 / red100
  ok:     { fg: '15803D', bg: 'DCFCE7' }, // palette.green600 / green100
  muted:  { fg: '64748B', bg: 'E2E8F0' }, // palette.slate500 / slate200 — pasife alinan/notr satirlar
} as const;

function headerCellStyle(hex: string) {
  return {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${hex}` } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
}

function dataCellStyle(hex: string, opts?: { bold?: boolean; textHex?: string }) {
  return {
    font: { bold: !!opts?.bold, color: { rgb: `FF${opts?.textHex ?? '1F2937'}` } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${hex}` } },
  };
}

/** Alt toplam satiri: grup rengiyle AYNI (koyu) zemin + beyaz kalin yazi — bir bakista "bu bir toplam satırı" belli olsun. */
function totalCellStyle(hex: string) {
  return {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${hex}` } },
    border: { top: { style: 'medium', color: { rgb: 'FFFFFFFF' } } },
  };
}

function setCell(ws: XLSXStyle.WorkSheet, r: number, c: number, value: string | number, style?: object, numFmt?: string) {
  const addr = XLSXStyle.utils.encode_cell({ r, c });
  ws[addr] = { t: typeof value === 'number' ? 'n' : 's', v: value };
  if (style) ws[addr].s = style;
  if (numFmt) ws[addr].z = numFmt;
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

/* ------------------------------------------------------------------ */
/* "Tüm Yılı Göster" — yıllık özet Excel'i                             */
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

const RANGE_HEADER = [
  'Dönem (Ay-Yıl)',
  'Genel Beklenen', 'Genel Tahsilat', 'Genel Kalan',
  'Asansör Beklenen', 'Asansör Tahsilat', 'Asansör Kalan',
  'Temizlik Beklenen', 'Temizlik Tahsilat', 'Temizlik Kalan',
];

/** Kolon index'i (0-based) -> hangi renk grubuna ait oldugu */
const RANGE_COLUMN_GROUP: (keyof typeof GROUP_COLORS)[] = [
  'period',
  'general', 'general', 'general',
  'elevator', 'elevator', 'elevator',
  'cleaning', 'cleaning', 'cleaning',
];

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
    RANGE_HEADER,
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

  for (let col = 0; col < RANGE_HEADER.length; col++) {
    const group = GROUP_COLORS[RANGE_COLUMN_GROUP[col]];
    const headerAddr = XLSXStyle.utils.encode_cell({ r: 0, c: col });
    if (ws[headerAddr]) ws[headerAddr].s = headerCellStyle(group.header);

    for (let row = 1; row <= rows.length; row++) {
      const addr = XLSXStyle.utils.encode_cell({ r: row, c: col });
      if (!ws[addr]) continue;
      if (col > 0) ws[addr].z = EXCEL_MONEY_FORMAT;
      ws[addr].s = dataCellStyle(group.soft);
    }

    const totalAddr = XLSXStyle.utils.encode_cell({ r: totalsRowIndex, c: col });
    if (ws[totalAddr]) {
      if (col > 0) ws[totalAddr].z = EXCEL_MONEY_FORMAT;
      ws[totalAddr].s = totalCellStyle(group.header);
    }
  }

  ws['!cols'] = [{ wch: 14 }, ...Array(9).fill({ wch: 17 })];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Yıllık Özet');
  return wb;
}

/** "Tüm Yılı Göster" pop-up'ındaki seçili [Başlangıç Ayı, Bitiş Ayı] aralığını Excel'e (.xlsx) aktarır. */
export async function exportRangeSummaryExcel(rows: RangeExcelRow[], fileNameBase: string): Promise<void> {
  await downloadWorkbook(buildRangeExcelWorkbook(rows), fileNameBase);
}

/* ------------------------------------------------------------------ */
/* Bugüne göre vade/gecikme durumu — hem liste hem cari ekstre kullanır */
/* ------------------------------------------------------------------ */

/**
 * `due_date` (o donemin KENDI vade tarihi — sunucuda calc_due_date() ile
 * hesaplanir) HER ZAMAN BUGÜNE göre kiyaslanir; goruntulenen donemin kendisi
 * gecmis/gelecek olsa bile "bugun itibariyla kac gun gecikti/kaldi" sorusuna
 * cevap verir (bkz. kullanici talebi: "geçen ayların tarihinden
 * bakılmayacak, her aya o ay için bakılacak" — due_date zaten o ayin kendi
 * tarihidir, sadece BUGUNE göre kıyas ekleniyor).
 */
function dueStatus(dueDate: string | null): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diffDays > 0) return { text: `${diffDays} gün gecikmiştir`, overdue: true };
  if (diffDays === 0) return { text: 'Bugün son gün', overdue: false };
  return { text: `${-diffDays} gün var`, overdue: false };
}

/* ------------------------------------------------------------------ */
/* Modül listesi — "⬇︎ Dışa Aktar" (Asansör/Temizlik Takip ekranı)      */
/* ------------------------------------------------------------------ */

const LEDGER_HEADER = [
  'Site Adı', 'Site Kodu', 'Bu Ay Aidat', 'Ekstra', 'Bu Ay Toplam', 'Bu Ay Ödenen',
  'Bu Dönemden Önceki Devreden Borç', 'Toplam Kalan Borç (Bugün İtibarıyla)',
  'Vade Tarihi', 'Gecikme Durumu', 'Notlar',
];

/**
 * Site listesini Excel'e aktarir. Eskiden "Gecikme Günü" kolonu SADECE
 * gecikmisse pozitif bir sayi yaziyordu, gecikmemisse "0" — esnaf kac gun
 * KALDIGINI goremiyordu (bkz. kullanici talebi). Simdi HER satir icin
 * bugune gore ya "X gün gecikmiştir" (kırmızı) ya da "X gün var"/"Bugün son
 * gün" (yeşil) yazar. "Bu Aydan Kalan Bakiye" kolonu KALDIRILDI (gereksiz
 * bulundu — bkz. kullanici talebi); yerine ihtiyaca yonelik iki kolon
 * kondu: bu donemden ONCEKI devreden borc VE bugun itibariyle TOPLAM kalan
 * borc (site_current_balance — hangi doneme bakilirsa bakilsin AYNI, bkz.
 * 0014 migration / kullanici geri bildirimi).
 */
function buildLedgerExcelWorkbook(rows: LedgerRow[], period: string, summary: PeriodSummary | null, module: ModuleType) {
  const brand = module === 'cleaning' ? GROUP_COLORS.cleaning : GROUP_COLORS.elevator;

  const aoa: (string | number)[][] = [
    LEDGER_HEADER,
    ...rows.map(r => {
      const status = dueStatus(r.due_date);
      return [
        r.site_name, r.site_code,
        num(r.base_fee), num(r.extra_total), num(r.total_due), num(r.net_paid),
        num(r.carried_over_balance), num(r.site_current_balance),
        r.due_date ? dateLabel(r.due_date) : '—',
        status ? status.text : '—',
        r.site_notes ?? '',
      ];
    }),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  const moneyCols = new Set([2, 3, 4, 5, 6, 7]);

  for (let col = 0; col < LEDGER_HEADER.length; col++) {
    const headerAddr = XLSXStyle.utils.encode_cell({ r: 0, c: col });
    if (ws[headerAddr]) ws[headerAddr].s = headerCellStyle(brand.header);

    for (let i = 0; i < rows.length; i++) {
      const row = i + 1;
      const addr = XLSXStyle.utils.encode_cell({ r: row, c: col });
      if (!ws[addr]) continue;

      if (col === 7) {
        // Toplam Kalan Borç — borçluysa kırmızı, alacaklı/sıfırsa yeşil tonda.
        const bal = num(rows[i].site_current_balance);
        const tone = bal > 0.01 ? STATUS_COLORS.danger : STATUS_COLORS.ok;
        ws[addr].s = dataCellStyle(tone.bg, { bold: true, textHex: tone.fg });
        ws[addr].z = EXCEL_MONEY_FORMAT;
      } else if (col === 9) {
        // Gecikme Durumu — gecikmisse kırmızı, degilse yeşil.
        const status = dueStatus(rows[i].due_date);
        const tone = status?.overdue ? STATUS_COLORS.danger : STATUS_COLORS.ok;
        ws[addr].s = dataCellStyle(tone.bg, { bold: true, textHex: tone.fg });
      } else {
        ws[addr].s = dataCellStyle(brand.soft);
        if (moneyCols.has(col)) ws[addr].z = EXCEL_MONEY_FORMAT;
      }
    }
  }

  ws['!cols'] = [
    { wch: 22 }, { wch: 10 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 13 },
    { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 28 },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Liste');

  if (summary) {
    const rate = num(summary.collection_rate_pct);
    const summaryAoa: (string | number)[][] = [
      [`AYLIK BİLANÇO — ${periodLabel(period)}`],
      ['Toplam Beklenen', num(summary.total_expected)],
      ['Tahsil Edilen', num(summary.total_collected)],
      ['Kalan Alacak', num(summary.total_balance)],
      ['Tahsilat Oranı', rate / 100],
      ['Site Sayısı', summary.site_count],
      ['Tamamlanan', summary.completed_count],
      ['Kısmi Ödeme', summary.partial_count],
      ['Bekliyor', summary.pending_count],
      ['Gecikmiş', summary.overdue_count],
    ];
    const sws = XLSXStyle.utils.aoa_to_sheet(summaryAoa);
    sws['A1'].s = { font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 13 }, fill: { patternType: 'solid', fgColor: { rgb: `FF${brand.header}` } } };
    sws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    for (let r = 1; r <= 3; r++) {
      setCell(sws, r, 0, summaryAoa[r][0], { font: { bold: true, color: { rgb: 'FF1F2937' } }, fill: { patternType: 'solid', fgColor: { rgb: `FF${brand.soft}` } } });
      setCell(sws, r, 1, summaryAoa[r][1] as number, { font: { bold: true, color: { rgb: 'FF1F2937' } }, fill: { patternType: 'solid', fgColor: { rgb: `FF${brand.soft}` } } }, EXCEL_MONEY_FORMAT);
    }
    setCell(sws, 4, 0, summaryAoa[4][0], { font: { color: { rgb: 'FF1F2937' } } });
    setCell(sws, 4, 1, summaryAoa[4][1] as number, { font: { color: { rgb: 'FF1F2937' } } }, '0.00%');
    for (let r = 5; r <= 9; r++) {
      setCell(sws, r, 0, summaryAoa[r][0], { font: { color: { rgb: 'FF1F2937' } } });
      setCell(sws, r, 1, summaryAoa[r][1] as number, { font: { color: { rgb: 'FF1F2937' } } });
    }
    sws['!cols'] = [{ wch: 22 }, { wch: 16 }];
    XLSXStyle.utils.book_append_sheet(wb, sws, 'Bilanço Özeti');
  }

  return wb;
}

/** Site listesini stilli Excel'e (.xlsx) cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportLedgerExcel(
  rows: LedgerRow[],
  fileNameBase: string,
  options: { period: string; summary: PeriodSummary | null; module: ModuleType },
): Promise<void> {
  await downloadWorkbook(buildLedgerExcelWorkbook(rows, options.period, options.summary, options.module), fileNameBase);
}

/* ------------------------------------------------------------------ */
/* Cari Ekstre — SiteStatementModal "⬇︎ Dışa Aktar"                    */
/* ------------------------------------------------------------------ */

const STATEMENT_HEADER = ['Ay/Dönem', 'Aidat', 'Ekstra', 'Toplam Beklenen', 'Ödenen', 'Kalan Bakiye', 'Not'];

/**
 * Siteye ozel cari ekstre — donemler eskiden yeniye. Pasife alinmis
 * (is_skipped) aylar SATIR OLARAK KALIR ama gri/soluk renkte gosterilir ve
 * "Not" kolonuna aciklama dusulur; TOPLAM satirlarina/nihai bakiyeye
 * KESINLIKLE dahil edilmezler (bkz. kullanici talebi: "TÜM ZAMANLAR
 * BEKLENEN'e pasife çekileni toplattırma" ve önceki "Bu Ayı Pasife Al"
 * ozelligi — set_ledger_skipped). Nihai bakiye, hesabini gosterecek sekilde
 * (Toplam Beklenen − Toplam Ödenen) ayri ayri satirlarla sunulur.
 */
function buildSiteStatementExcelWorkbook(rows: LedgerRow[], siteName: string) {
  const ordered = [...rows].sort((a, b) => a.period.localeCompare(b.period));

  let totalExpected = 0;
  let totalPaid = 0;
  for (const r of ordered) {
    if (r.is_skipped) continue;
    totalExpected += num(r.total_due);
    totalPaid += num(r.net_paid);
  }

  const finalState = finalBalanceState(num(ordered[ordered.length - 1]?.site_current_balance ?? '0'));
  const finalLabel = finalState.kind === 'debt' ? 'Borçlu' : finalState.kind === 'credit' ? 'Alacaklı' : 'Sıfırlandı / Borcu Yok';
  const finalTone = finalState.kind === 'debt' ? STATUS_COLORS.danger : STATUS_COLORS.ok;
  // Excel'de Borçlu POZİTİF, Alacaklı NEGATİF gösterilir — uygulamadaki
  // signed balance ile AYNI kural (bkz. money() kullanımı diğer ekranlarda).
  const finalSigned = finalState.kind === 'debt' ? finalState.amount : finalState.kind === 'credit' ? -finalState.amount : 0;

  const titleRowIdx = 0;
  const headerRowIdx = 2;
  const dataStart = 3;

  const aoa: (string | number)[][] = [
    [`Cari Ekstre — ${siteName}`],
    [],
    STATEMENT_HEADER,
    ...ordered.map(r => [
      periodLabel(r.period),
      num(r.base_fee), num(r.extra_total), num(r.total_due), num(r.net_paid), num(r.balance),
      r.is_skipped ? 'Pasife Alındı — toplamlara dahil değil' : '',
    ]),
    [],
    ['TÜM ZAMANLAR TOPLAM BEKLENEN (Pasife Alınanlar Hariç)', totalExpected],
    ['TOPLAM ÖDENEN', totalPaid],
    [`NİHAİ BAKİYE (Beklenen − Ödenen) — ${finalLabel}`, finalSigned],
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  ws[XLSXStyle.utils.encode_cell({ r: titleRowIdx, c: 0 })].s = {
    font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 13 },
    fill: { patternType: 'solid', fgColor: { rgb: `FF${GROUP_COLORS.period.header}` } },
  };
  ws['!merges'] = [{ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: STATEMENT_HEADER.length - 1 } }];

  for (let col = 0; col < STATEMENT_HEADER.length; col++) {
    const headerAddr = XLSXStyle.utils.encode_cell({ r: headerRowIdx, c: col });
    if (ws[headerAddr]) ws[headerAddr].s = headerCellStyle(GROUP_COLORS.period.header);

    for (let i = 0; i < ordered.length; i++) {
      const row = dataStart + i;
      const addr = XLSXStyle.utils.encode_cell({ r: row, c: col });
      if (!ws[addr]) continue;
      const skipped = ordered[i].is_skipped;
      ws[addr].s = skipped
        ? dataCellStyle(STATUS_COLORS.muted.bg, { textHex: STATUS_COLORS.muted.fg })
        : dataCellStyle(GROUP_COLORS.period.soft);
      if (col >= 1 && col <= 4) ws[addr].z = EXCEL_MONEY_FORMAT;
    }
  }

  const summaryRowStart = dataStart + ordered.length + 1;
  for (let r = summaryRowStart; r <= summaryRowStart + 2; r++) {
    const isFinal = r === summaryRowStart + 2;
    const labelAddr = XLSXStyle.utils.encode_cell({ r, c: 0 });
    const valueAddr = XLSXStyle.utils.encode_cell({ r, c: 1 });
    const tone = isFinal ? finalTone : STATUS_COLORS.muted;
    if (ws[labelAddr]) ws[labelAddr].s = { font: { bold: true, color: { rgb: `FF${isFinal ? tone.fg : '1F2937'}` } }, fill: isFinal ? { patternType: 'solid', fgColor: { rgb: `FF${tone.bg}` } } : undefined };
    if (ws[valueAddr]) {
      ws[valueAddr].s = { font: { bold: true, color: { rgb: `FF${isFinal ? tone.fg : '1F2937'}` } }, fill: isFinal ? { patternType: 'solid', fgColor: { rgb: `FF${tone.bg}` } } : undefined };
      ws[valueAddr].z = EXCEL_MONEY_FORMAT;
    }
  }

  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 34 }];
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Cari Ekstre');
  return wb;
}

/** Siteye ozel cari ekstreyi stilli Excel'e (.xlsx) cevirip indirir (Web) ya da paylasim menusune acar (native). */
export async function exportSiteStatementExcel(rows: LedgerRow[], siteName: string, fileNameBase: string): Promise<void> {
  await downloadWorkbook(buildSiteStatementExcelWorkbook(rows, siteName), fileNameBase);
}
