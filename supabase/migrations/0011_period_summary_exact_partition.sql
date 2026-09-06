-- =====================================================================
-- ELEVATOR360  |  0011_period_summary_exact_partition.sql
-- v_period_summary: partial_count / pending_count artik GECIKMIS
-- OLANLARI SAYMAZ — sayilar TAM TUTAR
-- ---------------------------------------------------------------------
-- SORUN: Liste ekranindaki ozet seridi "109 site · 3 tamamlandı ·
-- 2 eksik · 27 gecikmiş" seklinde 4 sayi gosteriyor ama bunlar
-- TOPLANDIGINDA site_count'u TUTMUYORDU (bkz. kullanici geri bildirimi).
-- Neden: eski partial_count/pending_count TUM kismi/bekleyen satirlari
-- sayiyordu (vadesi gecmis olsun olmasin), overdue_count ISE vadesi
-- gecmis TUM satirlari (hem bekleyen hem kismi odenmis) AYRICA
-- sayiyordu — yani vadesi gecmis kismi odemeler HEM "eksik" HEM
-- "gecikmiş" icinde CIFT sayiliyordu.
--
-- COZUM: partial_count ve pending_count artik SADECE vadesi GECMEMIS
-- satirlari sayar (status_key='partial' / 'pending'); overdue_count
-- degismedi (status_key IN ('overdue','overdue_partial') — vadesi gecmis
-- HER iki turu de zaten tek bir "gecikmiş" grubunda topluyordu, bu dogru).
-- Sonuc: completed_count + partial_count + pending_count + overdue_count
-- HER ZAMAN site_count'a esittir (bkz. status_key'in v_ledger'daki 5'li
-- ayrik/kapsayici CASE tanimi).
--
-- Kolon SIRASI/ADI DEGISMEDI (sadece filtre ifadeleri) — CREATE OR
-- REPLACE VIEW kisitlamasina takilmaz.
-- =====================================================================

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

    -- YENİ: sadece vadesi GEÇMEMİŞ kısmi ödemeler (status_key='partial').
    -- Vadesi geçmiş kısmi ödemeler artik SADECE overdue_count'ta sayılır.
    -- coalesce(...,false) SART: due_date NULL olan satirlarda ham "not(...)"
    -- ifadesi NULL doner ve satir HICBIR kovaya girmeden site_count'tan
    -- "kaybolur" (ilk denemede yakalanan gercek bir uyusmazlik nedeniydi).
    count(*) filter (
        where m.payment_state = 'partial'
          and not coalesce(m.due_date < current_date and m.balance > 0, false)
    )                                                                       as partial_count,

    -- YENİ: sadece vadesi GEÇMEMİŞ, hiç ödeme yapılmamış satırlar
    -- (status_key='pending', yani gerçek anlamda "Bekliyor").
    count(*) filter (
        where m.payment_state = 'pending'
          and not coalesce(m.due_date < current_date and m.balance > 0, false)
    )                                                                       as pending_count,

    -- DEĞİŞMEDİ: vadesi geçmiş VE hâlâ borcu olan (bekleyen + kısmi ödenmiş
    -- birlikte) — status_key IN ('overdue','overdue_partial').
    count(*) filter (where coalesce(m.due_date < current_date, false) and m.balance > 0) as overdue_count,

    sum(m.balance) filter (where m.due_date < current_date)                as overdue_amount,
    case when sum(m.total_due) > 0
         then round(sum(m.net_paid) / sum(m.total_due) * 100, 2)
         else 0 end                                   as collection_rate_pct
from public.monthly_ledger m
group by m.module, m.period;

comment on view public.v_period_summary is
    'Liste ekrani ust ozet kartlari. completed_count + partial_count + pending_count + overdue_count = site_count HER ZAMAN (ayrik/kapsayici partition — bkz. v_ledger.status_key).';
