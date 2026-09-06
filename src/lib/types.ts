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
export type QuickFilterKey = 'all' | 'unpaid' | 'partial' | 'overdue' | 'completed';

/** Liste ekranindaki filtre secenekleri — 'all' varsayilan */
export const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: 'all',       label: 'Tümü' },
  { key: 'unpaid',    label: 'Hiç Ödemeyenler' },
  { key: 'partial',   label: 'Kısmi Ödeyenler / Eksik' },
  { key: 'overdue',   label: 'Süresi Geçenler' },
  { key: 'completed', label: 'Borcu Bitenler / Tamamlandı' },
];

export function matchesQuickFilter(row: LedgerRow, key: QuickFilterKey): boolean {
  switch (key) {
    case 'unpaid':    return row.status_key === 'pending' || row.status_key === 'overdue';
    case 'partial':   return row.status_key === 'partial' || row.status_key === 'overdue_partial';
    case 'overdue':   return row.status_key === 'overdue' || row.status_key === 'overdue_partial';
    case 'completed': return row.status_key === 'completed' || row.status_key === 'overpaid';
    case 'all':
    default:          return true;
  }
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
