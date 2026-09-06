import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { num } from './format';
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

export function usePeriodSummary(module: ModuleType, period: string) {
  return useQuery({
    queryKey: ['summary', module, period],
    queryFn: async (): Promise<PeriodSummary | null> => {
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

/* ------------------------------------------------------------------ */
/* Site gecmisi (odeme sicili + gecmisten devreden bakiye)             */
/* ------------------------------------------------------------------ */
/**
 * Aylik bilanco (monthly_ledger) her donemi kendi SNAPSHOT'i olarak
 * saklar — bu mantiga dokunulmaz. "Gecmisten devreden borc" hicbir
 * yerde tutulmaz, tam da bu yuzden burada, secili donemden ONCEKI
 * donemlerin bakiyeleri toplanarak ISTEMCI TARAFINDA hesaplanir.
 */

/** Siteye ait, secili donemden once kalan en son N ay — "Odeme Gecmisi" mini listesi */
export function useSiteHistory(
  siteId: string | undefined, module: ModuleType, beforePeriod: string, limit = 6
) {
  return useQuery({
    queryKey: ['site-history', siteId, module, beforePeriod, limit],
    enabled: !!siteId,
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data, error } = await supabase
        .from('v_ledger')
        .select('*')
        .eq('site_id', siteId as string)
        .eq('module', module)
        .lt('period', beforePeriod)
        .order('period', { ascending: false })
        .limit(limit);
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
