-- =====================================================================
-- ELEVATOR360  |  0009_ledger_carried_over.sql
-- v_ledger'a carried_over_balance + site_notes eklenir
-- ---------------------------------------------------------------------
-- SORUN: "Geçmişten devreden borç" şu ana kadar sadece QuickEntryModal
-- içinde, tek bir site için, AYRI bir sorguyla (useCarriedOverBalance)
-- hesaplanıyordu. Liste karlarinda gorunmedigi icin esnaf "Tamamlandı"
-- yazan bir karti gorunce o siteye ait GECMISTEN gelen borcu FARK
-- ETMEYEBILIYORDU (bkz. kullanici geri bildirimi).
--
-- COZUM: carried_over_balance, HER satir icin (o satirin KENDI donemine
-- gore, "bugune" gore degil) korelasyonlu bir alt sorguyla view'e
-- eklenir — boylece useLedger() zaten cektigi TEK sorguda her site icin
-- bu deger hazir gelir; N+1 sorgu riski YOKTUR (mevcut
-- ledger_site_period_idx index'i kullanilir).
--
-- site_notes da ayni migration'da eklenir: sites.notes (site duzeyi not)
-- artik hem CSV disa aktarimda hem gerekirse arayuzde kullanilabilir
-- (monthly_ledger.notes'tan farkli — o zaten `notes` olarak mevcuttu).
--
-- Yeni kolonlar mevcut sutunlarin EN SONUNA eklenir — CREATE OR REPLACE
-- VIEW yalnizca sona ekleme yapildiginda mevcut sutunlari "yeniden
-- adlandirma" hatasi vermez (bkz. 0007 migration'inda ogrenilen ders).
-- =====================================================================

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

    -- UI filtresi için sabit anahtar
    case
        when m.payment_state in ('paid','overpaid')                       then 'completed'
        when m.due_date < current_date and m.payment_state = 'pending'    then 'overdue'
        when m.due_date < current_date and m.payment_state = 'partial'    then 'overdue_partial'
        when m.payment_state = 'partial'                                  then 'partial'
        else 'pending'
    end as status_key,

    -- Kullanıcıya gösterilen Türkçe etiket
    case
        when m.payment_state = 'overpaid'                                 then 'Fazla Ödeme'
        when m.payment_state = 'paid'                                     then 'Tamamlandı'
        when m.due_date < current_date and m.payment_state = 'pending'    then 'Gecikmiş'
        when m.due_date < current_date and m.payment_state = 'partial'    then 'Gecikmiş (Eksik)'
        when m.payment_state = 'partial'                                  then 'Eksik Ödeme'
        else 'Bekliyor'
    end as status_label,

    case when m.due_date < current_date and m.balance > 0
         then (current_date - m.due_date) else 0 end as days_overdue,

    (select count(*) from public.ledger_entries e where e.ledger_id = m.id) as entry_count,
    m.notes,
    m.is_locked,
    m.created_at,
    m.updated_at,
    s.is_active,

    -- YENİ: bu satırın KENDİ döneminden ÖNCEKİ tüm dönemlerin toplam
    -- açık bakiyesi — "Geçmişten Devreden Borç" artık her satırda hazır.
    (select coalesce(sum(m2.balance), 0)
       from public.monthly_ledger m2
      where m2.site_id = m.site_id
        and m2.period  < m.period)          as carried_over_balance,

    -- YENİ: site düzeyi not (sites.notes) — CSV dışa aktarımda kullanılır
    s.notes                                 as site_notes
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte). carried_over_balance: bu satırın döneminden önceki tüm dönemlerin toplam bakiyesi (kümülatif geçmiş borç/alacak).';
