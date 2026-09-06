-- =====================================================================
-- ELEVATOR360  |  0003_views.sql
-- Liste ve dashboard view'leri
-- ---------------------------------------------------------------------
-- security_invoker = on  ->  view'ler sorgulayan kullanıcının yetkisiyle
-- çalışır, yani RLS BYPASS EDİLMEZ. (Supabase'de en sık yapılan güvenlik
-- hatası bu ayarın unutulmasıdır.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_ledger  |  Ana liste ekranı
-- "Gecikmiş" ayrımı burada yapılır: vade bilgisi zamana bağlı olduğu için
-- tabloda saklanmaz, her sorguda güncel hesaplanır.
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
    m.updated_at
from public.monthly_ledger m
join public.sites s on s.id = m.site_id;

comment on view public.v_ledger is
    'Liste ekranının kaynağı. Sıralama: updated_at desc (en son işlem gören en üstte).';

-- ---------------------------------------------------------------------
-- v_period_summary  |  Dashboard üst kartları (seçili ay)
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
    count(*) filter (where m.payment_state = 'partial')                    as partial_count,
    count(*) filter (where m.payment_state = 'pending')                    as pending_count,
    count(*) filter (where m.due_date < current_date and m.balance > 0)    as overdue_count,
    sum(m.balance) filter (where m.due_date < current_date)                as overdue_amount,
    case when sum(m.total_due) > 0
         then round(sum(m.net_paid) / sum(m.total_due) * 100, 2)
         else 0 end                                   as collection_rate_pct
from public.monthly_ledger m
group by m.module, m.period;

-- ---------------------------------------------------------------------
-- v_site_receivables  |  Site bazında TOPLAM alacak (geçmişten devir dahil)
-- ---------------------------------------------------------------------
-- Devir (carry-over) hiçbir yerde saklanmaz, HESAPLANIR. Böylece geçmiş
-- bir ay düzeltildiğinde devir zinciri bozulmaz, kendiliğinden düzelir.
create or replace view public.v_site_receivables
with (security_invoker = on) as
select
    s.id                                as site_id,
    s.module,
    s.code                              as site_code,
    s.name                              as site_name,
    s.contract_status,
    s.monthly_fee                       as current_fee,
    coalesce(sum(m.total_due), 0)       as lifetime_billed,
    coalesce(sum(m.net_paid),  0)       as lifetime_collected,
    coalesce(sum(m.balance),   0)       as total_receivable,     -- toplam açık alacak
    coalesce(sum(m.balance) filter (where m.period < date_trunc('month', current_date)::date), 0)
                                        as carried_over,          -- geçmiş aylardan devreden
    coalesce(sum(m.balance) filter (where m.period = date_trunc('month', current_date)::date), 0)
                                        as current_month_balance,
    count(*) filter (where m.balance > 0)                     as open_period_count,
    min(m.period) filter (where m.balance > 0)                as oldest_open_period,
    max(current_date - m.due_date) filter (where m.balance > 0 and m.due_date < current_date)
                                        as max_days_overdue
from public.sites s
left join public.monthly_ledger m on m.site_id = s.id
group by s.id, s.module, s.code, s.name, s.contract_status, s.monthly_fee;

-- ---------------------------------------------------------------------
-- v_aging  |  Alacak yaşlandırma (aging) — tahsilat önceliklendirme
-- ---------------------------------------------------------------------
create or replace view public.v_aging
with (security_invoker = on) as
select
    s.module,
    s.id   as site_id,
    s.code as site_code,
    s.name as site_name,
    sum(m.balance)                                                              as total_due,
    sum(m.balance) filter (where m.due_date >= current_date)                    as not_yet_due,
    sum(m.balance) filter (where current_date - m.due_date between 1 and 30)    as d_1_30,
    sum(m.balance) filter (where current_date - m.due_date between 31 and 60)   as d_31_60,
    sum(m.balance) filter (where current_date - m.due_date between 61 and 90)   as d_61_90,
    sum(m.balance) filter (where current_date - m.due_date > 90)                as d_90_plus
from public.sites s
join public.monthly_ledger m on m.site_id = s.id
where m.balance > 0
group by s.module, s.id, s.code, s.name;

-- ---------------------------------------------------------------------
-- v_monthly_trend  |  Grafik kaynağı (eski "Özet" sayfasının karşılığı)
-- ---------------------------------------------------------------------
create or replace view public.v_monthly_trend
with (security_invoker = on) as
select
    module,
    period,
    to_char(period, 'YYYY-MM')                      as period_label,
    sum(total_due)                                  as expected,
    sum(net_paid)                                   as collected,
    sum(balance)                                    as outstanding,
    case when sum(total_due) > 0
         then round(sum(net_paid) / sum(total_due) * 100, 2) else 0 end as collection_rate_pct,
    -- Kümülatif açık alacak (dönem sonu itibarıyla toplam birikmiş borç)
    sum(sum(balance)) over (partition by module order by period) as cumulative_outstanding
from public.monthly_ledger
group by module, period
order by module, period;

-- ---------------------------------------------------------------------
-- v_entry_detail  |  "Bu tutar nereden geldi?" — hareket dökümü
-- ---------------------------------------------------------------------
create or replace view public.v_entry_detail
with (security_invoker = on) as
select
    e.id            as entry_id,
    e.ledger_id,
    m.module,
    m.period,
    s.code          as site_code,
    s.name          as site_name,
    e.entry_type,
    case e.entry_type
        when 'extra_charge' then 'Ekstra / Parça'
        when 'discount'     then 'İndirim / İptal'
        when 'payment'      then 'Tahsilat'
        when 'refund'       then 'İade'
    end             as entry_type_label,
    e.amount,
    case when e.entry_type in ('extra_charge','discount') then 'borc' else 'odeme' end as affects,
    e.description,
    e.entry_date,
    e.reference_no,
    p.full_name     as created_by_name,
    e.created_at
from public.ledger_entries e
join public.monthly_ledger m on m.id = e.ledger_id
join public.sites s          on s.id = m.site_id
left join public.profiles p  on p.id = e.created_by;
