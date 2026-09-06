-- =====================================================================
-- ELEVATOR360  |  0007_sites_is_active.sql
-- sites.is_active — contract_status'un TURETILMIS (generated) boolean
-- karsiligi
-- ---------------------------------------------------------------------
-- ONEMLI: Sozlesme feshi / pasife alma mimarisi ZATEN 0006'da tam
-- olarak kurulmustu:
--   - deactivate_site()  : sozlesmeyi belirtilen aydan itibaren kapatir,
--                          GECMIS bilancoya asla dokunmaz.
--   - open_period() / trg_site_open_current_period() / ensure_current_period():
--                          sadece contract_status = 'active' olan siteler
--                          icin yeni donem satiri acar.
-- Bu migration o mekanizmayi DEGISTIRMEZ veya TEKRARLAMAZ (iki ayri
-- "aktif mi" bayraginin birbirinden sapmasi riskini almamak icin).
-- is_active, contract_status'tan TURETILIR (generated always as) —
-- yalnizca sorgu/filtre tarafinda kolay bir boolean sunmak icindir ve
-- elle yazilamaz; tek gercek kaynak (source of truth) contract_status
-- olarak kalir.
-- =====================================================================

alter table public.sites
    add column is_active boolean generated always as (contract_status = 'active') stored;

comment on column public.sites.is_active is
    'contract_status = ''active'' oldugunda true. Turetilmis (generated) alan: elle yazilamaz. Tek gercek kaynak contract_status''tur; bkz. deactivate_site()/reactivate_site() (0006_period_automation.sql).';

create index sites_is_active_idx on public.sites (module, is_active);

-- v_ledger'a is_active eklenir ki liste ekrani "Pasif Siteler" filtresini
-- dogrudan bu alanla kursun (contract_status karsiligi ayni, sadece
-- boolean okumasi daha ergonomik).
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
    s.is_active
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte).';
