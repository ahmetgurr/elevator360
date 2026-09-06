-- =====================================================================
-- ELEVATOR360  |  0010_ledger_site_current_balance.sql
-- v_ledger'a site_current_balance eklenir
-- ---------------------------------------------------------------------
-- SORUN (Bozyel 4 senaryosu): Bir site 6 ay borcunu odemeyip Agustos'ta
-- tek seferde tum borcunu kapatiyor. Agustos kartinda "Gecmis borc
-- kapatildi" dogru gorunuyor. AMA esnaf gecmise donup Temmuz'a baktiginda
-- o ay hala "borçlu" (kirmizi) gorunuyor — carried_over_balance (0009)
-- SADECE o satirin KENDI doneminden ONCEKI bakiyeyi toplar, "bugune"
-- kadar OLANI degil. Esnaf hangi gecmis ay kartina bakarsa baksin,
-- sitenin BUGUNKU nihai durumunu bilmek istiyor.
--
-- COZUM: site_current_balance, sitenin BUGUNE (gercek takvim ayina)
-- kadar acilmis TUM donemlerinin toplam bakiyesidir. carried_over_balance
-- gibi satirin KENDI donemine gore DEGIL, "bugune" gore sabit bir
-- korelasyonlu alt sorgudur — bu yuzden ayni siteye ait HANGI donem
-- satirina bakilirsa bakilsin (Temmuz da olsa Agustos da olsa) DEGER
-- AYNIDIR: sitenin su anki gercek net bakiyesi.
--
-- Yeni kolon mevcut sutunlarin EN SONUNA eklenir (bkz. 0007/0009'da
-- ogrenilen ders: CREATE OR REPLACE VIEW sadece sona ekleme yapildiginda
-- mevcut sutunlari "yeniden adlandirma" hatasi vermez).
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

    -- Bu satırın KENDİ döneminden ÖNCEKİ tüm dönemlerin toplam açık bakiyesi
    (select coalesce(sum(m2.balance), 0)
       from public.monthly_ledger m2
      where m2.site_id = m.site_id
        and m2.period  < m.period)          as carried_over_balance,

    -- Site düzeyi not (sites.notes) — CSV dışa aktarımda kullanılır
    s.notes                                 as site_notes,

    -- YENİ: sitenin BUGÜNE (gerçek takvim ayına) kadar açılmış tüm
    -- dönemlerinin toplam net bakiyesi — hangi dönem kartına bakılırsa
    -- bakılsın DEĞER AYNIDIR. Pozitif: hâlâ borçlu. Negatif: fazla
    -- ödeme/alacaklı. Sıfır: nihai olarak kapanmış.
    (select coalesce(sum(m3.balance), 0)
       from public.monthly_ledger m3
      where m3.site_id = m.site_id
        and m3.period  <= date_trunc('month', current_date)::date) as site_current_balance
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte). carried_over_balance: satırın döneminden önceki bakiye toplamı. site_current_balance: sitenin BUGÜNE kadarki nihai net bakiyesi (hangi dönem satırına bakılırsa bakılsın aynıdır).';
