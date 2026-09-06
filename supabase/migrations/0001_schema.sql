-- =====================================================================
-- ELEVATOR360  |  0001_schema.sql
-- Temel şema: enum'lar, tablolar, kısıtlar (constraints), index'ler
-- Postgres 15+ / Supabase
-- ---------------------------------------------------------------------
-- TASARIM İLKELERİ
--  1) Tek şema, iki modül: her kayıt `module` kolonu ile ayrışır
--     (discriminator pattern). Kod bir kez yazılır.
--  2) Aylık Bilanço (monthly_ledger): site + dönem başına TEK satır.
--     UNIQUE(site_id, period) ile mükerrer kayıt veritabanı seviyesinde
--     imkânsızdır — uygulama hatası bile bunu delemez.
--  3) Toplamlar ASLA elle yazılmaz. monthly_ledger'daki tutarlar,
--     ledger_entries (hareket defteri) satırlarından trigger ile
--     yeniden hesaplanır (0002'de).
--  4) base_fee bir SNAPSHOT'tır. Siteye zam yapılınca geçmiş aylar
--     değişmez — eski Excel'deki en büyük hata buydu.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM TİPLERİ
-- ---------------------------------------------------------------------
create type module_type      as enum ('elevator', 'cleaning');
create type contract_status  as enum ('active', 'passive');
create type user_role        as enum ('admin', 'operator', 'viewer');

-- Hareket tipleri. amount HER ZAMAN pozitiftir; yönü tip belirler.
--   extra_charge : ekstra hizmet / parça          -> borcu ARTIRIR
--   discount     : indirim / hatalı borcun iptali -> borcu AZALTIR
--   payment      : tahsilat                       -> ödemeyi ARTIRIR
--   refund       : iade / hatalı tahsilat iptali  -> ödemeyi AZALTIR
create type entry_type       as enum ('extra_charge', 'discount', 'payment', 'refund');

-- Ödeme durumu (vade bilgisi İÇERMEZ; "Gecikmiş" ayrımı view'de yapılır)
create type payment_state    as enum ('pending', 'partial', 'paid', 'overpaid');

-- ---------------------------------------------------------------------
-- PROFILES  |  auth.users'ın iş tarafındaki karşılığı
-- ---------------------------------------------------------------------
create table public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    full_name       text          not null,
    role            user_role     not null default 'operator',
    -- Kişi bazında modül yetkisi: sadece asansör, sadece temizlik ya da ikisi
    allowed_modules module_type[] not null default array['elevator','cleaning']::module_type[],
    is_active       boolean       not null default true,
    created_at      timestamptz   not null default now(),
    constraint profiles_modules_not_empty check (array_length(allowed_modules, 1) >= 1)
);

comment on table public.profiles is 'Uygulama kullanıcıları; RLS politikaları bu tablodan beslenir.';

-- ---------------------------------------------------------------------
-- SITES  |  Siteler / Apartmanlar (ana tanımlama)
-- ---------------------------------------------------------------------
create table public.sites (
    id               uuid            primary key default gen_random_uuid(),
    module           module_type     not null,
    code             text            not null,          -- AST-001 / TMZ-001 (otomatik üretilir)
    name             text            not null,
    monthly_fee      numeric(14,2)   not null default 0 check (monthly_fee >= 0),
    service_day      smallint        check (service_day between 1 and 31),
    contract_status  contract_status not null default 'active',
    contract_start   date,
    contract_end     date,
    address          text,
    contact_name     text,
    contact_phone    text,
    notes            text,
    created_at       timestamptz     not null default now(),
    updated_at       timestamptz     not null default now(),
    created_by       uuid            references public.profiles(id) on delete set null,

    constraint sites_code_uniq  unique (module, code),
    constraint sites_dates_ok   check (contract_end is null or contract_start is null
                                       or contract_end >= contract_start)
);

-- Aynı modülde aynı isimde ikinci site açılamaz (büyük/küçük harf ve
-- baştaki/sondaki boşluk farkı mükerrer sayılmaz).
create unique index sites_name_uniq on public.sites (module, lower(btrim(name)));

create index sites_module_status_idx on public.sites (module, contract_status);

comment on column public.sites.monthly_fee is
    'GÜNCEL aylık ücret. Geçmiş aylar bu değerden ETKİLENMEZ; her ay kendi base_fee snapshot''ını taşır.';

-- ---------------------------------------------------------------------
-- MONTHLY_LEDGER  |  Aylık Bilanço — site+dönem başına TEK satır
-- ---------------------------------------------------------------------
create table public.monthly_ledger (
    id             uuid          primary key default gen_random_uuid(),
    site_id        uuid          not null references public.sites(id) on delete restrict,
    module         module_type   not null,                 -- sites'tan denormalize (filtre + RLS hızı)
    period         date          not null,                 -- dönemin ilk günü: 2026-06-01
    due_date       date,                                   -- service_day'den hesaplanır (0002)

    -- SNAPSHOT: dönem açılırken sites.monthly_fee buraya kopyalanır
    base_fee       numeric(14,2) not null default 0 check (base_fee >= 0),

    -- Aşağıdaki 4 kolon SADECE trigger tarafından yazılır (0002).
    extra_total    numeric(14,2) not null default 0 check (extra_total    >= 0),
    discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
    paid_total     numeric(14,2) not null default 0 check (paid_total     >= 0),
    refund_total   numeric(14,2) not null default 0 check (refund_total   >= 0),

    -- TÜRETİLMİŞ kolonlar: Postgres hesaplar, kimse elle yazamaz.
    total_due      numeric(14,2) generated always as
                     (base_fee + extra_total - discount_total) stored,
    net_paid       numeric(14,2) generated always as
                     (paid_total - refund_total) stored,
    balance        numeric(14,2) generated always as
                     ((base_fee + extra_total - discount_total) - (paid_total - refund_total)) stored,

    payment_state  payment_state generated always as (
        case
            when (paid_total - refund_total) <= 0
                 and (base_fee + extra_total - discount_total) <= 0 then 'paid'::payment_state
            when (paid_total - refund_total) <= 0                   then 'pending'::payment_state
            when (paid_total - refund_total)
                 < (base_fee + extra_total - discount_total)        then 'partial'::payment_state
            when (paid_total - refund_total)
                 = (base_fee + extra_total - discount_total)        then 'paid'::payment_state
            else 'overpaid'::payment_state
        end
    ) stored,

    notes          text,
    is_locked      boolean       not null default false,   -- ay kapatıldıysa yazma yasak
    locked_at      timestamptz,
    locked_by      uuid          references public.profiles(id) on delete set null,
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),   -- "en son işlem gören üstte" sıralaması

    -- ***** MÜKERRER KAYIT ENGELİ — sistemin en kritik kısıtı *****
    constraint ledger_site_period_uniq unique (site_id, period),
    constraint ledger_period_is_month_start check (period = date_trunc('month', period)::date)
);

create index ledger_period_module_idx on public.monthly_ledger (module, period desc);
create index ledger_site_period_idx   on public.monthly_ledger (site_id, period desc);
create index ledger_updated_idx       on public.monthly_ledger (module, updated_at desc);
-- Açık borcu olan dönemler (devir hesabı ve gecikme listesi bu index'i kullanır)
create index ledger_open_balance_idx  on public.monthly_ledger (site_id, period)
    where payment_state in ('pending','partial');

comment on table public.monthly_ledger is
    'Aylık bilanço. Tutar kolonları trigger ile hesaplanır; UPDATE ile elle değiştirilmemelidir.';

-- ---------------------------------------------------------------------
-- LEDGER_ENTRIES  |  Hareket defteri — her ekstra/tahsilat ayrı satır
-- ---------------------------------------------------------------------
create table public.ledger_entries (
    id                uuid          primary key default gen_random_uuid(),
    ledger_id         uuid          not null references public.monthly_ledger(id) on delete cascade,
    entry_type        entry_type    not null,
    amount            numeric(14,2) not null check (amount > 0),
    description       text,
    entry_date        date          not null default current_date,
    reference_no      text,                                -- dekont / fatura / fiş no

    -- ÇİFT KAYIT KALKANI: mobilde çift dokunma veya ağ tekrarı halinde
    -- aynı client_request_id ile gelen ikinci istek veritabanınca reddedilir.
    client_request_id text,

    created_by        uuid          references public.profiles(id) on delete set null,
    created_at        timestamptz   not null default now(),

    constraint entries_client_request_uniq unique (client_request_id)
);

create index entries_ledger_idx on public.ledger_entries (ledger_id, created_at desc);
create index entries_date_idx   on public.ledger_entries (entry_date desc);

comment on table public.ledger_entries is
    'Değiştirilemez hareket kaydı. Yanlış giriş silinir ya da ters kayıt (discount/refund) ile düzeltilir; monthly_ledger toplamları otomatik güncellenir.';

-- ---------------------------------------------------------------------
-- AUDIT_LOG  |  Kim, ne zaman, neyi değiştirdi
-- ---------------------------------------------------------------------
create table public.audit_log (
    id          bigserial   primary key,
    table_name  text        not null,
    record_id   uuid,
    action      text        not null check (action in ('INSERT','UPDATE','DELETE')),
    old_data    jsonb,
    new_data    jsonb,
    changed_by  uuid,
    changed_at  timestamptz not null default now()
);

create index audit_record_idx on public.audit_log (table_name, record_id, changed_at desc);
create index audit_time_idx   on public.audit_log (changed_at desc);
