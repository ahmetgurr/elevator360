import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { currentPeriod, num, shiftPeriod } from './format';
import type { LedgerRow, ModuleType, PeriodSummary } from './types';

/* ------------------------------------------------------------------ */
/* Donem otomasyonu                                                    */
/* ------------------------------------------------------------------ */

/**
 * Eksik aylari acar. Uygulama modul ekranina her girdiginde bir kez
 * cagrilir; zaten acik aylar icin hicbir sey yapmaz (idempotent).
 * Kullanicinin "her ay listeyi kur" diye ugrasmasina gerek kalmaz.
 */
export async function ensureCurrentPeriod(module: ModuleType) {
  const { error } = await supabase.rpc('ensure_current_period', { p_module: module });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

export const ledgerKey = (module: ModuleType, period: string) =>
  ['ledger', module, period] as const;

export function useLedger(module: ModuleType, period: string) {
  return useQuery({
    queryKey: ledgerKey(module, period),
    queryFn: async (): Promise<LedgerRow[]> => {
      // Once eksik donemleri kapat, sonra listeyi cek.
      await ensureCurrentPeriod(module);
      const { data, error } = await supabase
        .from('v_ledger')
        .select('*')
        .eq('module', module)
        .eq('period', period)
        .order('updated_at', { ascending: false }); // en son islem goren en ustte
      if (error) throw new Error(error.message);
      return (data ?? []) as LedgerRow[];
    },
  });
}

export function usePeriodSummary(module: ModuleType, period: string, enabled = true) {
  return useQuery({
    queryKey: ['summary', module, period],
    enabled,
    queryFn: async (): Promise<PeriodSummary | null> => {
      // Home ekranindaki "Patron Ozeti" da bu hook'u kullanir; kullanici
      // henuz o modulun liste ekranina girmemis olabilir, bu yuzden ay
      // otomasyonu burada da tetiklenir (idempotent, ucuz).
      await ensureCurrentPeriod(module);
      const { data, error } = await supabase
        .from('v_period_summary')
        .select('*')
        .eq('module', module)
        .eq('period', period)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as PeriodSummary) ?? null;
    },
  });
}

export interface ProjectedSummary {
  site_count: number;
  total_expected: number;
}

/** open_period()'un sozlesme tarihi kontroluyle BIREBIR ayni uygunluk kurali */
function isEligibleForPeriod(
  s: { contract_start: string | null; contract_end: string | null }, period: string
): boolean {
  return (!s.contract_start || s.contract_start <= period) &&
         (!s.contract_end || s.contract_end >= period);
}

/**
 * Henuz acilmamis (gelecek) bir donem icin "ne kadar alacagim olacak"
 * ONGORUSU. KESINLIKLE monthly_ledger'a satir YAZMAZ / OKUMAZ — sadece
 * o an aktif olan sitelerin GUNCEL monthly_fee'lerini, open_period()'un
 * kullandigi AYNI uygunluk kuraliyla (contract_start/contract_end)
 * client tarafinda toplar. Boylece:
 *  - Veri tutarliligi hicbir zaman riske girmez (spekulatif satir yok),
 *  - Ucret degisirse ya da site pasife alinirsa ongoru KENDILIGINDEN
 *    guncel kalir (her sorguda yeniden hesaplanir),
 *  - O ay gercekten geldiginde open_period() zaten AYNI siteleri acar.
 */
export function useProjectedSummary(module: ModuleType, period: string, enabled = true) {
  return useQuery({
    queryKey: ['projected-summary', module, period],
    enabled,
    queryFn: async (): Promise<ProjectedSummary> => {
      const { data, error } = await supabase
        .from('sites')
        .select('monthly_fee, contract_start, contract_end')
        .eq('module', module)
        .eq('contract_status', 'active');
      if (error) throw new Error(error.message);

      const eligible = (data ?? []).filter(
        (s: { contract_start: string | null; contract_end: string | null }) => isEligibleForPeriod(s, period)
      );
      const total = eligible.reduce(
        (sum, s: { monthly_fee: string }) => sum + num(s.monthly_fee), 0
      );
      return { site_count: eligible.length, total_expected: total };
    },
  });
}

export interface ProjectedSite {
  site_id: string;
  site_code: string;
  site_name: string;
  service_day: number | null;
  monthly_fee: string;
}

/**
 * useProjectedSummary'nin site-bazli karsiligi — liste ekraninda gelecek
 * ay icin "bu siteler acilacak" kartlarini gostermek icin. Ayni sekilde
 * monthly_ledger'a HICBIR SEY yazmaz/okumaz, sadece o an uygun (aktif +
 * sozlesme tarihine giren) siteleri dondurur.
 */
export function useProjectedSites(module: ModuleType, period: string, enabled = true) {
  return useQuery({
    queryKey: ['projected-sites', module, period],
    enabled,
    queryFn: async (): Promise<ProjectedSite[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, code, name, service_day, monthly_fee, contract_start, contract_end')
        .eq('module', module)
        .eq('contract_status', 'active');
      if (error) throw new Error(error.message);

      return (data ?? [])
        .filter(s => isEligibleForPeriod(s, period))
        .map((s: { id: string; code: string; name: string; service_day: number | null; monthly_fee: string }) => ({
          site_id: s.id, site_code: s.code, site_name: s.name, service_day: s.service_day, monthly_fee: s.monthly_fee,
        }));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Site gecmisi (odeme sicili + gecmisten devreden bakiye)             */
/* ------------------------------------------------------------------ */
/**
 * Aylik bilanco (monthly_ledger) her donemi kendi SNAPSHOT'i olarak
 * saklar — bu mantiga dokunulmaz. "Gecmisten devreden borc" hicbir
 * yerde tutulmaz, tam da bu yuzden burada, secili donemden ONCEKI
 * donemlerin bakiyeleri toplanarak ISTEMCI TARAFINDA hesaplanir.
 */

/**
 * Siteye ait TUM diger donemlerin ("Odeme Gecmisi" / "Notlar" mini listesi).
 * Zaman kisitlamasi YOK: ileri tarihli donemler de dahil, sadece o an
 * ekranda ayrica gosterilen guncel donem (period) listeden cikarilir.
 */
export function useSiteHistory(
  siteId: string | undefined, module: ModuleType, period: string
) {
  return useQuery({
    queryKey: ['site-history', siteId, module, period],
    enabled: !!siteId,
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data, error } = await supabase
        .from('v_ledger')
        .select('*')
        .eq('site_id', siteId as string)
        .eq('module', module)
        .neq('period', period)
        .order('period', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as LedgerRow[];
    },
  });
}

/** Secili donemden ONCEKI tum ayların toplam acik bakiyesi (devir) */
export function useCarriedOverBalance(siteId: string | undefined, module: ModuleType, period: string) {
  return useQuery({
    queryKey: ['carried-over', siteId, module, period],
    enabled: !!siteId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('v_ledger')
        .select('balance')
        .eq('site_id', siteId as string)
        .eq('module', module)
        .lt('period', period);
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((sum, r: { balance: string }) => sum + num(r.balance), 0);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Yeni site / apartman ekleme                                         */
/* ------------------------------------------------------------------ */

export interface CreateSiteInput {
  module: ModuleType;
  name: string;
  monthlyFee: number;
  /** Bilancosunun aktif olacagi ilk ay: 'YYYY-MM-01' */
  startPeriod: string;
  /** Isteğe bağlı; siteye özel not/açıklama */
  notes?: string | null;
}

/**
 * Yeni site olusturur ve bilancosunu "Baslangic Ayi"ndan bugune kadar
 * acar. sites INSERT'i sonrasi trg_sites_open_current_period yalnizca
 * CARI ayin satirini acar (0006_period_automation.sql); baslangic ayi
 * geciste kaldiysa aradaki aylar burada ensure_ledger() ile tamamlanir.
 * Baslangic ayi ileri tarihliyse dongu hic calismaz — o ay geldiginde
 * ensure_current_period() zaten kendiliginden acar.
 */
export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSiteInput) => {
      const { data: site, error } = await supabase
        .from('sites')
        .insert({
          module: input.module,
          name: input.name.trim(),
          monthly_fee: input.monthlyFee,
          contract_start: input.startPeriod,
          notes: input.notes?.trim() || null,
        })
        .select('id, module, name')
        .single();
      if (error) throw new Error(translateDbError(error.message));

      const cur = currentPeriod();
      let p = input.startPeriod;
      let guard = 0;
      while (p <= cur && guard < 600) {
        const { error: ledgerError } = await supabase.rpc('ensure_ledger', {
          p_site_id: site.id, p_period: p,
        });
        if (ledgerError) throw new Error(translateDbError(ledgerError.message));
        p = shiftPeriod(p, 1);
        guard += 1;
      }
      return site as { id: string; module: ModuleType; name: string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ledger', vars.module] });
      qc.invalidateQueries({ queryKey: ['summary', vars.module] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Site duzenleme / zam                                                */
/* ------------------------------------------------------------------ */

export interface SiteRecord {
  id: string;
  module: ModuleType;
  name: string;
  monthly_fee: string;
  contract_status: 'active' | 'passive';
  is_active: boolean;
  contract_start: string | null;
  notes: string | null;
}

/** Duzenleme formunun GUNCEL adi/ucreti/durumu/baslangic ayini/notunu sites tablosundan taze okumasi icin */
export function useSite(siteId: string | undefined) {
  return useQuery({
    queryKey: ['site', siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<SiteRecord> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, module, name, monthly_fee, contract_status, is_active, contract_start, notes')
        .eq('id', siteId as string)
        .single();
      if (error) throw new Error(error.message);
      return data as SiteRecord;
    },
  });
}

export interface SetSiteStartPeriodInput {
  siteId: string;
  module: ModuleType;
  /** Yeni baslangic ayi: 'YYYY-MM-01' */
  newStartPeriod: string;
}

/**
 * Yanlis girilen "Baslangic Ayi"ni duzeltir. set_site_start_period()
 * RPC'sine devredilir (0008_site_start_period.sql): baslangic erkene
 * cekildiyse aradaki eksik aylari acar, geciye atildiysa aradaki
 * yalnizca BOS (hareketsiz) aylari temizler — hareket gormus hicbir ay
 * asla silinmez/degistirilmez.
 */
export function useSetSiteStartPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetSiteStartPeriodInput) => {
      const { data, error } = await supabase.rpc('set_site_start_period', {
        p_site_id: input.siteId,
        p_new_start_period: input.newStartPeriod,
      });
      if (error) throw new Error(translateDbError(error.message));
      const row = Array.isArray(data) ? data[0] : data;
      return row as { added_periods: number; removed_empty_periods: number; kept_periods_with_data: number } | undefined;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ledger', vars.module] });
      qc.invalidateQueries({ queryKey: ['summary', vars.module] });
      qc.invalidateQueries({ queryKey: ['site-history', vars.siteId, vars.module] });
      qc.invalidateQueries({ queryKey: ['carried-over', vars.siteId, vars.module] });
      qc.invalidateQueries({ queryKey: ['site', vars.siteId] });
    },
  });
}

export interface DeactivateSiteInput {
  siteId: string;
  module: ModuleType;
  /** Sozlesmenin bu aydan ITIBAREN feshedilecegi; oncesi hic dokunulmaz */
  effectivePeriod: string;
}

/**
 * Sozlesme feshi / pasife alma. deactivate_site() RPC'sine devredilir
 * (0006_period_automation.sql): sites.contract_status = 'passive' yapar,
 * yalnizca effectivePeriod ve SONRASINDAKI, HENUZ HAREKET GORMEMIS BOS
 * donem satirlarini temizler. Hareketi/odemesi olan hicbir ay, gecmis
 * hicbir ay SILINMEZ veya DEGISTIRILMEZ — site KESINLIKLE fiziksel
 * olarak silinmez, sadece yeni donem acilmasi durur (bkz. open_period /
 * ensure_current_period'in contract_status = 'active' kosulu).
 */
export function useDeactivateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeactivateSiteInput) => {
      const { data, error } = await supabase.rpc('deactivate_site', {
        p_site_id: input.siteId,
        p_effective_period: input.effectivePeriod,
      });
      if (error) throw new Error(translateDbError(error.message));
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ledger', vars.module] });
      qc.invalidateQueries({ queryKey: ['summary', vars.module] });
      qc.invalidateQueries({ queryKey: ['site', vars.siteId] });
    },
  });
}

export interface ReactivateSiteInput {
  siteId: string;
  module: ModuleType;
}

/** Feshedilmis bir sozlesmeyi bugunden itibaren yeniden aktiflestirir. */
export function useReactivateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReactivateSiteInput) => {
      const { error } = await supabase.rpc('reactivate_site', { p_site_id: input.siteId });
      if (error) throw new Error(translateDbError(error.message));
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ledger', vars.module] });
      qc.invalidateQueries({ queryKey: ['summary', vars.module] });
      qc.invalidateQueries({ queryKey: ['site', vars.siteId] });
    },
  });
}

export interface UpdateSiteDetailsInput {
  siteId: string;
  module: ModuleType;
  name: string;
  previousName: string;
  newFee: number;
  previousFee: number;
  /** Zam SADECE bu donem ve sonrasini etkiler; gecmis aylar hic dokunulmaz */
  effectivePeriod: string;
  notes: string | null;
  previousNotes: string | null;
}

/**
 * Site adini ve/veya aylik ucretini gunceller. Ucret degisikligi
 * set_site_fee() RPC'sine devredilir (0002_functions.sql /
 * 0006_period_automation.sql) — bu fonksiyon sites.monthly_fee'yi
 * gunceller VE yalnizca effectivePeriod ve SONRASINDAKI, kilitli
 * OLMAYAN monthly_ledger satirlarinin base_fee'sini yeniden yazar.
 * Gecmis aylarin bilancosu ASLA degismez (esnafin eski Excel hatasi
 * tam olarak buydu — bkz. set_site_fee yorum bloğu).
 */
export function useUpdateSiteDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSiteDetailsInput) => {
      const trimmedName = input.name.trim();

      if (trimmedName !== input.previousName) {
        const { error } = await supabase
          .from('sites')
          .update({ name: trimmedName })
          .eq('id', input.siteId);
        if (error) throw new Error(translateDbError(error.message));
      }

      if (input.newFee !== input.previousFee) {
        const { error } = await supabase.rpc('set_site_fee', {
          p_site_id: input.siteId,
          p_new_fee: input.newFee,
          p_effective_period: input.effectivePeriod,
        });
        if (error) throw new Error(translateDbError(error.message));
      }

      if (input.notes !== input.previousNotes) {
        const { error } = await supabase
          .from('sites')
          .update({ notes: input.notes })
          .eq('id', input.siteId);
        if (error) throw new Error(translateDbError(error.message));
      }

      return { name: trimmedName };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ledger', vars.module] });
      qc.invalidateQueries({ queryKey: ['summary', vars.module] });
      qc.invalidateQueries({ queryKey: ['site-history', vars.siteId, vars.module] });
      qc.invalidateQueries({ queryKey: ['carried-over', vars.siteId, vars.module] });
      qc.invalidateQueries({ queryKey: ['site', vars.siteId] });
    },
  });
}

/**
 * Bir ay'in not alanini dogrudan gunceller/temizler (duzenle veya sil).
 * post_transaction'ın aksine EKLEMEZ, TAMAMEN DEĞİŞTİRİR — kart uzerinden
 * duzenleme/silme bunu gerektirir. Sadece `notes` kolonuna yazar; bilanco
 * tutarlarina hicbir sekilde dokunmaz (RLS bunu zaten fiziksel olarak
 * engeller — bkz. 0004_rls.sql: grant update (notes) on monthly_ledger).
 * Kilitli (is_locked) donemlerde RLS satiri guncellemeye izin vermez;
 * bu durumda 0 satir doner ve kullaniciya anlamli bir hata gosterilir.
 */
export function useUpdateNote(module: ModuleType, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ledgerId, notes }: { ledgerId: string; notes: string | null; siteId: string }) => {
      const { data, error } = await supabase
        .from('monthly_ledger')
        .update({ notes })
        .eq('id', ledgerId)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(translateDbError(error.message));
      if (!data) throw new Error('Bu dönem kapatılmış veya yetkiniz yok; not değiştirilemedi.');
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ledgerKey(module, period) });
      qc.invalidateQueries({ queryKey: ['site-history', vars.siteId, module] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Hizli kayit                                                         */
/* ------------------------------------------------------------------ */

export interface PostTransactionInput {
  siteId: string;
  period: string;
  extra?: number;
  extraDesc?: string;
  payment?: number;
  paymentDesc?: string;
  note?: string;
  /** Cift dokunma kalkani: modal her acildiginda bir kez uretilir */
  requestId: string;
}

export function usePostTransaction(module: ModuleType, period: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PostTransactionInput) => {
      const { data, error } = await supabase.rpc('post_transaction', {
        p_site_id: input.siteId,
        p_period: input.period,
        p_extra: input.extra ?? 0,
        p_extra_desc: input.extraDesc ?? null,
        p_payment: input.payment ?? 0,
        p_payment_desc: input.paymentDesc ?? null,
        p_note: input.note ?? null,
        p_client_request_id: input.requestId,
      });
      if (error) throw new Error(translateDbError(error.message));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ledgerKey(module, period) });
      qc.invalidateQueries({ queryKey: ['summary', module, period] });
    },
  });
}

export function translateDbError(msg: string): string {
  if (/entries_client_request_uniq/i.test(msg))
    return 'Bu işlem zaten kaydedilmiş. Aynı kayıt ikinci kez işlenmedi.';
  if (/kapatılmış|kilitli/i.test(msg))
    return 'Bu dönem kapatılmış; kayıt eklenemez.';
  if (/yetkiniz yok/i.test(msg))
    return 'Bu modül için yetkiniz bulunmuyor.';
  if (/sites_name_uniq/i.test(msg))
    return 'Bu isimde bir site zaten var.';
  if (/permission denied/i.test(msg))
    return 'Bu işlem için yetkiniz yok.';
  return msg;
}
