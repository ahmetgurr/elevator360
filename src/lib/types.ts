/** Veritabani gorunumlerinin (view) TypeScript karsiliklari */

export type ModuleType = 'elevator' | 'cleaning';
export type StatusKey = 'pending' | 'partial' | 'overdue' | 'overdue_partial' | 'completed' | 'overpaid';
export type PaymentState = 'pending' | 'partial' | 'paid' | 'overpaid';
export type UserRole = 'admin' | 'operator' | 'viewer';

export const MODULE_LABEL: Record<ModuleType, string> = {
  elevator: 'Asansör Takip',
  cleaning: 'Temizlik Takip',
};

/** Disa aktarilan dosya adlarinda kullanilan ASCII modul etiketi */
export const MODULE_FILE_LABEL: Record<ModuleType, string> = {
  elevator: 'Asansor',
  cleaning: 'Temizlik',
};

/** public.v_ledger */
export interface LedgerRow {
  ledger_id: string;
  module: ModuleType;
  period: string;
  period_year: number;
  period_month: number;
  site_id: string;
  site_code: string;
  site_name: string;
  service_day: number | null;
  contract_status: 'active' | 'passive';
  is_active: boolean;
  contact_name: string | null;
  contact_phone: string | null;
  due_date: string | null;
  base_fee: string;
  extra_total: string;
  discount_total: string;
  paid_total: string;
  refund_total: string;
  total_due: string;
  net_paid: string;
  balance: string;
  payment_state: PaymentState;
  status_key: StatusKey;
  status_label: string;
  days_overdue: number;
  entry_count: number;
  notes: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Esnafin alacak-verecek takibinde ise yarayacak sade filtre kurgusu.
 * Veritabanindaki ayrintili status_key degerleri (pending/partial/overdue/
 * overdue_partial/completed/overpaid), esnafin tek bakista anlayacagi
 * gruplar halinde birlestirilir. 'overdue' grubu, odeme durumundan
 * bagimsiz olarak suresi gecmis tum kayitlari gosterir; bu yuzden diger
 * gruplarla kesisebilir (ornegin hic odemeyip suresi de gecmis bir kayit
 * hem "Hiç Ödemeyenler" hem "Süresi Geçenler" icinde gorunur).
 */
export type QuickFilterKey = 'all' | 'unpaid' | 'partial' | 'overdue' | 'completed' | 'passive';

/**
 * Liste ekranindaki filtre secenekleri — 'all' varsayilan.
 * Pasife alinan (sozlesmesi feshedilen) siteler ana listede kalabalik
 * yapmasin diye 'passive' DISINDA HICBIR filtre onlari gostermez;
 * gecmis kayitlarini gormek icin kullanici bilerek "Pasif Siteler"i
 * secmelidir (bkz. matchesQuickFilter).
 */
export const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: 'all',       label: 'Tümü' },
  { key: 'unpaid',    label: 'Hiç Ödemeyenler' },
  { key: 'partial',   label: 'Kısmi Ödeyenler / Eksik' },
  { key: 'overdue',   label: 'Süresi Geçenler' },
  { key: 'completed', label: 'Borcu Bitenler / Tamamlandı' },
  { key: 'passive',   label: 'Pasif Siteler' },
];

/**
 * `!== false` (degil `truthy` kontrolu) kasitli: 0007 migration'i
 * uygulanmadan once v_ledger'da is_active kolonu henuz yoktur ve
 * Supabase bu alani `undefined` dondurur. `undefined`, "pasif" degil
 * "henuz bilinmiyor" anlamina gelmeli — aksi halde migration'dan once
 * calisan bir istemcide TUM siteler yanlislikla "pasif" sayilip ana
 * listeden kaybolur.
 */
export function matchesQuickFilter(row: LedgerRow, key: QuickFilterKey): boolean {
  const isActive = row.is_active !== false;
  switch (key) {
    case 'unpaid':    return isActive && (row.status_key === 'pending' || row.status_key === 'overdue');
    case 'partial':   return isActive && (row.status_key === 'partial' || row.status_key === 'overdue_partial');
    case 'overdue':   return isActive && (row.status_key === 'overdue' || row.status_key === 'overdue_partial');
    case 'completed': return isActive && (row.status_key === 'completed' || row.status_key === 'overpaid');
    case 'passive':   return !isActive;
    case 'all':
    default:          return isActive;
  }
}

/**
 * Liste sirasi. FilterDropdown'daki "Duruma gore filtrele"den FARKLIDIR:
 * filtre satirlari GIZLER, sıralama ise HICBIRINI gizlemez — sadece
 * eslesenleri baş tarafa alir (stabil sort). 'recent' varsayilan ve ayni
 * zamanda "Filtreyi Kaldır" gorevi gorur (DB zaten updated_at desc verir).
 */
export type SortKey = 'recent' | 'due_asc' | 'due_desc' | 'paid' | 'unpaid' | 'partial';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent',   label: 'Filtreyi Kaldır (En son işlem gören)' },
  { key: 'due_asc',  label: 'Zamanı önce olanlar' },
  { key: 'due_desc', label: 'Zamanı sonra olanlar' },
  { key: 'paid',     label: 'Ödemesi yapılanlar' },
  { key: 'unpaid',   label: 'Ödemesi yapılmayanlar' },
  { key: 'partial',  label: 'Eksik ödeme yapanlar' },
];

/** Array.prototype.sort (ES2019+) stabildir: eslesmeyenlerin kendi aralarindaki sira bozulmaz */
export function sortLedgerRows(rows: LedgerRow[], key: SortKey): LedgerRow[] {
  if (key === 'recent') return rows;
  const arr = [...rows];
  switch (key) {
    case 'due_asc':
      return arr.sort((a, b) => (a.due_date ?? '9999-99-99').localeCompare(b.due_date ?? '9999-99-99'));
    case 'due_desc':
      return arr.sort((a, b) => (b.due_date ?? '0000-00-00').localeCompare(a.due_date ?? '0000-00-00'));
    case 'paid':
      return arr.sort((a, b) => Number(Number(b.net_paid) > 0) - Number(Number(a.net_paid) > 0));
    case 'unpaid':
      return arr.sort((a, b) => Number(Number(b.net_paid) === 0) - Number(Number(a.net_paid) === 0));
    case 'partial':
      return arr.sort((a, b) => Number(isPartial(b)) - Number(isPartial(a)));
    default:
      return arr;
  }
}

function isPartial(row: LedgerRow): boolean {
  return row.status_key === 'partial' || row.status_key === 'overdue_partial';
}

/** public.v_period_summary */
export interface PeriodSummary {
  module: ModuleType;
  period: string;
  site_count: number;
  total_expected: string;
  total_collected: string;
  total_balance: string;
  completed_count: number;
  partial_count: number;
  pending_count: number;
  overdue_count: number;
  overdue_amount: string | null;
  collection_rate_pct: string;
}

/** public.profiles */
export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  allowed_modules: ModuleType[];
  is_active: boolean;
}
