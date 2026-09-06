-- =====================================================================
-- ELEVATOR360  |  0008_site_start_period.sql
-- "Başlangıç Ayı" duzeltme  |  set_site_start_period
-- ---------------------------------------------------------------------
-- Yeni site eklerken yanlis "Baslangic Ayi" secilirse (or. Temmuz yerine
-- Eylul girilmis), bu fonksiyon o tarihi duzeltir VE ilgili aylarin
-- monthly_ledger satirlarini GUVENLI sekilde kaydirir:
--
--   BASLANGIC ERKENE cekildiyse (or. Eylul -> Temmuz):
--     aradaki eksik aylar (bugune kadar olanlar) ensure_ledger() ile
--     acilir — tipki yeni site olustururken yapilan geriye donuk
--     borclandirma gibi (bkz. useCreateSite / api.ts).
--
--   BASLANGIC GECIYE atildiysa (or. Temmuz -> Eylul):
--     aradaki aylardan yalnizca HIC HAREKET GORMEMIS BOS satirlar
--     silinir. Hareketi/odemesi olan hicbir ay ASLA silinmez; fonksiyon
--     kac ayin korundugunu raporlar (deactivate_site() ile AYNI guvenlik
--     deseni — bkz. 0006_period_automation.sql).
--
-- Iki yonde de GECMISE (bugunden onceki, hareket gormus) hicbir satira
-- zorla dokunulmaz; sadece BOS satirlar silinir ya da eksik satirlar
-- acilir.
-- =====================================================================

create or replace function public.set_site_start_period(
    p_site_id          uuid,
    p_new_start_period date
)
returns table (
    added_periods           int,
    removed_empty_periods   int,
    kept_periods_with_data  int
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new_start date := date_trunc('month', p_new_start_period)::date;
    v_old_start date;
    v_current   date := date_trunc('month', current_date)::date;
    v_added     int := 0;
    v_removed   int := 0;
    v_kept      int := 0;
    v_p         date;
    v_guard     int := 0;
begin
    perform public.assert_site_access(p_site_id);

    select contract_start into v_old_start from public.sites where id = p_site_id;
    if v_old_start is null then
        v_old_start := v_new_start;
    end if;

    update public.sites
       set contract_start = v_new_start, updated_at = now()
     where id = p_site_id;

    if v_new_start < v_old_start then
        -- Baslangic ERKENE cekildi: eksik aylari (bugune kadar) ac
        v_p := v_new_start;
        while v_p < v_old_start and v_p <= v_current and v_guard < 600 loop
            perform public.ensure_ledger(p_site_id, v_p);
            v_added := v_added + 1;
            v_p := (v_p + interval '1 month')::date;
            v_guard := v_guard + 1;
        end loop;

    elsif v_new_start > v_old_start then
        -- Baslangic GECIYE atildi: aradaki BOS (hareketsiz) aylari temizle
        with del as (
            delete from public.monthly_ledger m
             where m.site_id = p_site_id
               and m.period >= v_old_start
               and m.period <  v_new_start
               and m.is_locked = false
               and m.extra_total = 0
               and m.discount_total = 0
               and m.paid_total = 0
               and m.refund_total = 0
               and not exists (select 1 from public.ledger_entries e where e.ledger_id = m.id)
            returning 1
        )
        select count(*) into v_removed from del;

        -- Hareket gormus oldugu icin korunan (silinmeyen) aylar
        select count(*) into v_kept
          from public.monthly_ledger m
         where m.site_id = p_site_id
           and m.period >= v_old_start
           and m.period <  v_new_start;
    end if;

    return query select v_added, v_removed, v_kept;
end $$;

comment on function public.set_site_start_period(uuid, date) is
    'Sitenin baslangic ayini duzeltir; aradaki aylari guvenli sekilde acar (erken) ya da sadece BOS olanlari temizler (geç). Hareket gormus hicbir ay silinmez.';

revoke all    on function public.set_site_start_period(uuid, date) from public, anon;
grant  execute on function public.set_site_start_period(uuid, date) to authenticated;
