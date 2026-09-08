-- =====================================================================
-- ELEVATOR360  |  0014_ledger_period_skip.sql
-- "Bu Ayı Pasife Al" — TEK bir ay için istisna (mizan dışı bırakma)
-- ---------------------------------------------------------------------
-- SORUN: Esnaf bazen belirli bir site+ay için "bu ay parayı almıyorum"
-- diyor (ör. arıza nedeniyle hizmet verilmedi, jest, vb.). Bu KESİNLİKLE
-- "Sözleşme Feshi / Siteyi Pasife Alma" (deactivate_site, 0006) DEĞİLDİR:
-- gelecek aylar açılmaya devam eder, geçmiş aylar hiç bozulmaz — sadece
-- SEÇİLİ AY genel hesaplamalardan (Kasa Özeti, Bilanço, devir/bakiye,
-- Excel) hariç tutulur.
--
-- ÇÖZÜM: monthly_ledger'a is_skipped bayrağı eklenir. Tutar kolonlarına
-- (base_fee/extra_total/...) DOKUNULMAZ — satır olduğu gibi durur, sadece
-- toplamalarda/carry-over'da/nihai bakiyede YOK SAYILIR. Böylece bayrak
-- geri alındığında (reaktivasyon) hiçbir veri kaybı olmaz, her şey
-- kendiliğinden yeniden hesaplanır (view'ler zaten canlı SUM/COUNT'tur).
-- =====================================================================

alter table public.monthly_ledger
    add column if not exists is_skipped boolean not null default false;

comment on column public.monthly_ledger.is_skipped is
    'true ise bu tek ay (site+dönem) genel bilanço/kasa özeti/devir/Excel hesaplamalarından İSTİSNA olarak hariç tutulur. Sözleşme feshinden (sites.contract_status) TAMAMEN BAĞIMSIZDIR — bkz. set_ledger_skipped().';

-- ---------------------------------------------------------------------
-- v_ledger  |  is_skipped kolonu + status_key/status_label + devir/nihai
-- bakiye hesaplarının bu ayları hariç tutması (0013'ün devamı)
-- ---------------------------------------------------------------------
create or replace view public.v_ledger
with (security_invoker = on) as
select
    m.id                                    as ledger_id,
    m.module,
    m.period,
    extract(year  from m.period)::int       as period_year,
    extract(month from m.period)::int       as period_month,
    s.id                                    as site_id,
    s.code                                  as site_code,
    s.name                                  as site_name,
    s.service_day,
    s.contract_status,
    s.contact_name,
    s.contact_phone,
    m.due_date,
    m.base_fee,
    m.extra_total,
    m.discount_total,
    m.paid_total,
    m.refund_total,
    m.total_due,
    m.net_paid,
    m.balance,
    m.payment_state,

    -- UI filtresi için sabit anahtar — is_skipped HER ŞEYDEN ÖNCE kontrol edilir
    case
        when m.is_skipped                                                 then 'skipped'
        when m.payment_state in ('paid','overpaid')                       then 'completed'
        when m.due_date < current_date and m.payment_state = 'pending'    then 'overdue'
        when m.due_date < current_date and m.payment_state = 'partial'    then 'overdue_partial'
        when m.payment_state = 'partial'                                  then 'partial'
        else 'pending'
    end as status_key,

    -- Kullanıcıya gösterilen Türkçe etiket
    case
        when m.is_skipped                                                 then 'Bu Ay Pasife Alındı'
        when m.payment_state = 'overpaid'                                 then 'Bu Ay Fazla Ödeme'
        when m.payment_state = 'paid'                                     then 'Bu Ay Tamamlandı'
        when m.due_date < current_date and m.payment_state = 'pending'    then 'Ödeme Süresi Geçti'
        when m.due_date < current_date and m.payment_state = 'partial'    then 'Süresi Geçti (Eksik)'
        when m.payment_state = 'partial'                                  then 'Bu Ay Eksik Ödeme'
        else 'Bu Ay Bekliyor'
    end as status_label,

    case when m.due_date < current_date and m.balance > 0
         then (current_date - m.due_date) else 0 end as days_overdue,

    (select count(*) from public.ledger_entries e where e.ledger_id = m.id) as entry_count,
    m.notes,
    m.is_locked,
    m.created_at,
    m.updated_at,
    s.is_active,

    -- Bu satırın KENDİ döneminden ÖNCEKİ tüm dönemlerin toplam açık bakiyesi.
    -- Pasife alınmış (is_skipped) aylar devir zincirine KATILMAZ.
    (select coalesce(sum(m2.balance), 0)
       from public.monthly_ledger m2
      where m2.site_id = m.site_id
        and m2.period  < m.period
        and not m2.is_skipped)              as carried_over_balance,

    -- Site düzeyi not (sites.notes) — CSV dışa aktarımda kullanılır
    s.notes                                 as site_notes,

    -- Sitenin BUGÜNE kadar açılmış tüm dönemlerinin toplam net bakiyesi.
    -- Pasife alınmış aylar bu nihai bakiyeye DAHİL EDİLMEZ.
    (select coalesce(sum(m3.balance), 0)
       from public.monthly_ledger m3
      where m3.site_id = m.site_id
        and m3.period  <= date_trunc('month', current_date)::date
        and not m3.is_skipped)              as site_current_balance,

    m.is_skipped
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte). status_label: HER ZAMAN o donemin kendi durumunu anlatir (bkz. "Bu Ay ..." on eki) — sitenin genel/devreden bakiyesi icin site_current_balance kullanilir. carried_over_balance: satırın döneminden önceki bakiye toplamı. is_skipped=true olan aylar carried_over_balance/site_current_balance''tan HARİÇ TUTULUR (bkz. set_ledger_skipped).';

-- ---------------------------------------------------------------------
-- v_period_summary  |  Dashboard üst kartları — pasife alınan aylar
-- Kasa Özeti / Bilanço toplamlarına HİÇ DAHİL EDİLMEZ
-- ---------------------------------------------------------------------
create or replace view public.v_period_summary
with (security_invoker = on) as
select
    m.module,
    m.period,
    count(*)                                          as site_count,
    sum(m.base_fee)                                   as base_expected,
    sum(m.extra_total)                                as extra_expected,
    sum(m.discount_total)                             as discount_total,
    sum(m.total_due)                                  as total_expected,   -- "Toplam Alacak"
    sum(m.net_paid)                                   as total_collected,  -- "Tahsil Edilen"
    sum(m.balance)                                    as total_balance,    -- "Kalan Borç"
    count(*) filter (where m.payment_state in ('paid','overpaid'))         as completed_count,

    count(*) filter (
        where m.payment_state = 'partial'
          and not coalesce(m.due_date < current_date and m.balance > 0, false)
    )                                                                       as partial_count,

    count(*) filter (
        where m.payment_state = 'pending'
          and not coalesce(m.due_date < current_date and m.balance > 0, false)
    )                                                                       as pending_count,

    count(*) filter (where coalesce(m.due_date < current_date, false) and m.balance > 0) as overdue_count,

    sum(m.balance) filter (where m.due_date < current_date)                as overdue_amount,
    case when sum(m.total_due) > 0
         then round(sum(m.net_paid) / sum(m.total_due) * 100, 2)
         else 0 end                                   as collection_rate_pct
from public.monthly_ledger m
where not m.is_skipped
group by m.module, m.period;

comment on view public.v_period_summary is
    'Liste ekrani ust ozet kartlari. completed_count + partial_count + pending_count + overdue_count = site_count HER ZAMAN (ayrik/kapsayici partition — bkz. v_ledger.status_key). is_skipped=true olan aylar (bkz. set_ledger_skipped) TAMAMEN HARİÇ TUTULUR — "bu ay parayı almıyorum" istisnası genel mizanı bozmaz.';

-- ---------------------------------------------------------------------
-- set_ledger_skipped  |  "Bu Ayı Pasife Al" / geri al
-- ---------------------------------------------------------------------
-- Sözleşme feshinden (deactivate_site) TAMAMEN FARKLI ve BAĞIMSIZDIR:
-- ne siteyi pasife alır ne gelecek ayları iptal eder ne de geçmişi
-- değiştirir — SADECE tek bir monthly_ledger satırının hesaplamalara
-- dahil olup olmayacağını değiştirir. Kilitli (is_locked) dönemlerde
-- diğer tüm yazma işlemleri gibi engellenir.
create or replace function public.set_ledger_skipped(
    p_ledger_id uuid,
    p_skipped   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_site_id uuid;
    v_locked  boolean;
begin
    select site_id, is_locked into v_site_id, v_locked
      from public.monthly_ledger where id = p_ledger_id;

    if not found then
        raise exception 'Dönem kaydı bulunamadı.';
    end if;

    perform public.assert_site_access(v_site_id);

    if not public.can_write() then
        raise exception 'Bu işlem için yetkiniz yok.' using errcode = '42501';
    end if;

    if v_locked then
        raise exception 'Bu dönem kapatılmış; pasife alma/geri alma yapılamaz.';
    end if;

    update public.monthly_ledger
       set is_skipped = p_skipped, updated_at = now()
     where id = p_ledger_id;
end $$;

comment on function public.set_ledger_skipped(uuid, boolean) is
    '"Bu Ayı Pasife Al" istisnası. Sözleşme feshi/siteyi pasife alma (deactivate_site) İLE KARIŞTIRILMAMALI — sadece TEK bir ayı genel hesaplamalardan hariç tutar/geri katar; gelecek aylar ve geçmiş hiç etkilenmez.';

revoke all on function public.set_ledger_skipped(uuid, boolean) from public, anon;
grant execute on function public.set_ledger_skipped(uuid, boolean) to authenticated;
