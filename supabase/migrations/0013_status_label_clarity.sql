-- =====================================================================
-- ELEVATOR360  |  0013_status_label_clarity.sql
-- v_ledger.status_label metinleri daha aciklayici hale getirilir
-- ---------------------------------------------------------------------
-- SORUN (saha geri bildirimi): Bir site kartinda "Tamamlandı" rozeti
-- gorunce esnaf bunu "bu sitenin HİÇ borcu kalmadı" diye okuyabiliyordu
-- — oysa rozet sadece O AYIN kendi tahakkukunun kapandigini soyler;
-- sitenin gecmisten devreden baska bir borcu olabilir (bkz.
-- carried_over_balance / site_current_balance, 0009-0010). Ayni sekilde
-- "Süresi Geçenler" ne surenin gectigini belirtmiyordu.
--
-- COZUM: status_label'daki TUM kisa statu metinleri "bu ay/donem"
-- kapsamini acikca belirtecek sekilde genisletildi. status_key (filtre/
-- eslesme mantiginda kullanilan sabit anahtar) DEGISMEDI — sadece
-- KULLANICIYA gosterilen metin degisti, hicbir istemci mantigini
-- etkilemez.
--
-- Kolon SIRASI/ADI DEGISMEDI (sadece bir CASE ifadesinin deger
-- metinleri) — CREATE OR REPLACE VIEW kisitlamasina takilmaz.
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

    -- UI filtresi için sabit anahtar — DEĞİŞMEDİ
    case
        when m.payment_state in ('paid','overpaid')                       then 'completed'
        when m.due_date < current_date and m.payment_state = 'pending'    then 'overdue'
        when m.due_date < current_date and m.payment_state = 'partial'    then 'overdue_partial'
        when m.payment_state = 'partial'                                  then 'partial'
        else 'pending'
    end as status_key,

    -- Kullanıcıya gösterilen Türkçe etiket — "bu ay" kapsamı netleştirildi
    case
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

    -- Bu satırın KENDİ döneminden ÖNCEKİ tüm dönemlerin toplam açık bakiyesi
    (select coalesce(sum(m2.balance), 0)
       from public.monthly_ledger m2
      where m2.site_id = m.site_id
        and m2.period  < m.period)          as carried_over_balance,

    -- Site düzeyi not (sites.notes) — CSV dışa aktarımda kullanılır
    s.notes                                 as site_notes,

    -- Sitenin BUGÜNE (gerçek takvim ayına) kadar açılmış tüm dönemlerinin
    -- toplam net bakiyesi — hangi dönem kartına bakılırsa bakılsın AYNIDIR.
    (select coalesce(sum(m3.balance), 0)
       from public.monthly_ledger m3
      where m3.site_id = m.site_id
        and m3.period  <= date_trunc('month', current_date)::date) as site_current_balance
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte). status_label: HER ZAMAN o donemin kendi durumunu anlatir (bkz. "Bu Ay ..." on eki) — sitenin genel/devreden bakiyesi icin site_current_balance kullanilir. carried_over_balance: satırın döneminden önceki bakiye toplamı.';
