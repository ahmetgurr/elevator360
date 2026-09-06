-- =====================================================================
-- ELEVATOR360  |  0002_functions.sql
-- Trigger'lar ve iş mantığı fonksiyonları
-- ---------------------------------------------------------------------
-- ALTIN KURAL: monthly_ledger'daki tutarlar artırımlı (+=) DEĞİL,
-- her seferinde hareket defterinden SIFIRDAN toplanarak yazılır.
-- Böylece kayma (drift) matematiksel olarak imkânsızdır; iki kişi aynı
-- anda giriş yapsa bile sonuç doğrudur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- YETKİ YARDIMCILARI
-- Aşağıdaki iş fonksiyonları SECURITY DEFINER'dır (RLS'i aşarlar), bu yüzden
-- modül yetkisini kendileri kontrol etmek ZORUNDADIR.
-- ---------------------------------------------------------------------
create or replace function public.has_module(p_module module_type)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
         where id = auth.uid()
           and is_active
           and p_module = any (allowed_modules)
    )
$$;

create or replace function public.assert_module_access(p_module module_type)
returns void language plpgsql stable as $$
begin
    if auth.uid() is null then
        raise exception 'Oturum bulunamadı.' using errcode = '42501';
    end if;
    if not public.has_module(p_module) then
        raise exception 'Bu modül için yetkiniz yok: %', p_module using errcode = '42501';
    end if;
end $$;

create or replace function public.assert_site_access(p_site_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare v_module module_type;
begin
    select module into v_module from public.sites where id = p_site_id;
    if not found then
        raise exception 'Site bulunamadı: %', p_site_id;
    end if;
    perform public.assert_module_access(v_module);
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

-- Dönem + hizmet gününden vade tarihi (ay sonu taşmasına karşı korumalı:
-- hizmet günü 31 ise Şubat'ta 28/29'a çekilir)
create or replace function public.calc_due_date(p_period date, p_service_day smallint)
returns date language sql immutable as $$
    select case
        when p_service_day is null then null
        else date_trunc('month', p_period)::date
             + (least(p_service_day,
                      extract(day from (date_trunc('month', p_period)
                                        + interval '1 month - 1 day'))::smallint) - 1)
    end
$$;

-- Site kodu otomatik üretimi: AST-001 (asansör) / TMZ-001 (temizlik)
create or replace function public.generate_site_code()
returns trigger language plpgsql as $$
declare
    v_prefix text;
    v_next   int;
begin
    if new.code is not null and btrim(new.code) <> '' then
        return new;
    end if;
    v_prefix := case new.module when 'elevator' then 'AST' else 'TMZ' end;
    select coalesce(max(substring(code from '\d+$')::int), 0) + 1
      into v_next
      from public.sites
     where module = new.module and code ~ ('^' || v_prefix || '-\d+$');
    new.code := v_prefix || '-' || lpad(v_next::text, 3, '0');
    return new;
end $$;

create trigger trg_sites_code
    before insert on public.sites
    for each row execute function public.generate_site_code();

create trigger trg_sites_updated
    before update on public.sites
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Ledger satırı açılırken module / due_date / base_fee otomatik dolar
-- ---------------------------------------------------------------------
create or replace function public.fill_ledger_defaults()
returns trigger language plpgsql as $$
declare
    v_site public.sites%rowtype;
begin
    select * into v_site from public.sites where id = new.site_id;
    if not found then
        raise exception 'Site bulunamadı: %', new.site_id;
    end if;

    new.module   := v_site.module;
    new.due_date := public.calc_due_date(new.period, v_site.service_day);

    -- base_fee SNAPSHOT: açılış anındaki ücret dondurulur
    if tg_op = 'INSERT' and (new.base_fee is null or new.base_fee = 0) then
        new.base_fee := v_site.monthly_fee;
    end if;
    return new;
end $$;

create trigger trg_ledger_defaults
    before insert on public.monthly_ledger
    for each row execute function public.fill_ledger_defaults();

create trigger trg_ledger_updated
    before update on public.monthly_ledger
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ÇEKİRDEK: toplamları hareket defterinden yeniden hesapla
-- ---------------------------------------------------------------------
create or replace function public.recalc_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.monthly_ledger m
       set extra_total    = coalesce(t.extra,  0),
           discount_total = coalesce(t.disc,   0),
           paid_total     = coalesce(t.paid,   0),
           refund_total   = coalesce(t.refund, 0),
           updated_at     = now()
      from (
            select
                sum(amount) filter (where entry_type = 'extra_charge') as extra,
                sum(amount) filter (where entry_type = 'discount')     as disc,
                sum(amount) filter (where entry_type = 'payment')      as paid,
                sum(amount) filter (where entry_type = 'refund')       as refund
            from public.ledger_entries
            where ledger_id = p_ledger_id
           ) t
     where m.id = p_ledger_id;
end $$;

create or replace function public.trg_entries_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'DELETE' then
        perform public.recalc_ledger(old.ledger_id);
        return old;
    end if;
    perform public.recalc_ledger(new.ledger_id);
    -- Hareket başka bir döneme taşındıysa eski dönem de düzeltilir
    if tg_op = 'UPDATE' and old.ledger_id <> new.ledger_id then
        perform public.recalc_ledger(old.ledger_id);
    end if;
    return new;
end $$;

create trigger trg_entries_recalc
    after insert or update or delete on public.ledger_entries
    for each row execute function public.trg_entries_recalc();

-- Kilitli döneme yazma yasağı + created_by otomatik doldurma
create or replace function public.guard_entry_write()
returns trigger language plpgsql as $$
declare
    v_locked boolean;
    v_ledger uuid := coalesce(new.ledger_id, old.ledger_id);
begin
    select is_locked into v_locked from public.monthly_ledger where id = v_ledger;
    if v_locked then
        raise exception 'Bu dönem kapatılmış (kilitli); hareket eklenemez/değiştirilemez.'
            using errcode = 'check_violation';
    end if;

    if tg_op = 'INSERT' then
        new.created_by := coalesce(new.created_by, auth.uid());
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end $$;

create trigger trg_entries_guard
    before insert or update or delete on public.ledger_entries
    for each row execute function public.guard_entry_write();

-- ---------------------------------------------------------------------
-- DÖNEM AÇMA  |  Aktif tüm siteler için o ayın satırını üretir
-- Aynı ay ikinci kez çalıştırılsa bile mükerrer satır AÇMAZ (idempotent).
-- ---------------------------------------------------------------------
create or replace function public.open_period(
    p_module module_type,
    p_period date default date_trunc('month', current_date)::date
)
returns table (created_count int, existing_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period  date := date_trunc('month', p_period)::date;
    v_created int;
    v_total   int;
begin
    perform public.assert_module_access(p_module);

    select count(*) into v_total
      from public.sites
     where module = p_module and contract_status = 'active';

    with ins as (
        insert into public.monthly_ledger (site_id, module, period, base_fee)
        select s.id, s.module, v_period, s.monthly_fee
          from public.sites s
         where s.module = p_module
           and s.contract_status = 'active'
        on conflict (site_id, period) do nothing
        returning 1
    )
    select count(*) into v_created from ins;

    return query select v_created, (v_total - v_created);
end $$;

-- Tek site için dönem satırını garantiler; yoksa açar, varsa id'sini döner
create or replace function public.ensure_ledger(p_site_id uuid, p_period date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period date := date_trunc('month', p_period)::date;
    v_id     uuid;
begin
    perform public.assert_site_access(p_site_id);

    select id into v_id
      from public.monthly_ledger
     where site_id = p_site_id and period = v_period;

    if v_id is null then
        insert into public.monthly_ledger (site_id, period)
        values (p_site_id, v_period)
        on conflict (site_id, period) do update set updated_at = now()  -- yarış durumunda da id döner
        returning id into v_id;
    end if;

    return v_id;
end $$;

-- ---------------------------------------------------------------------
-- HIZLI KAYIT  |  "İlave İşlem / Ödeme Ekle" modalının tek çağrısı
-- Kullanıcı kafadan toplama yapmaz: sadece "bu sefer ne oldu"yu girer.
-- ---------------------------------------------------------------------
create or replace function public.post_transaction(
    p_site_id           uuid,
    p_period            date,
    p_extra             numeric default 0,
    p_extra_desc        text    default null,
    p_payment           numeric default 0,
    p_payment_desc      text    default null,
    p_entry_date        date    default current_date,
    p_note              text    default null,
    p_client_request_id text    default null      -- çift dokunma kalkanı
)
returns public.monthly_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ledger_id uuid;
    v_row       public.monthly_ledger%rowtype;
begin
    perform public.assert_site_access(p_site_id);

    if coalesce(p_extra, 0) < 0 or coalesce(p_payment, 0) < 0 then
        raise exception 'Tutarlar negatif olamaz. Düzeltme için discount/refund hareketi kullanın.';
    end if;
    if coalesce(p_extra, 0) = 0 and coalesce(p_payment, 0) = 0 and p_note is null then
        raise exception 'İşlem boş: en az bir tutar ya da not girilmeli.';
    end if;

    v_ledger_id := public.ensure_ledger(p_site_id, p_period);

    if coalesce(p_extra, 0) > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values
            (v_ledger_id, 'extra_charge', p_extra, p_extra_desc, p_entry_date,
             nullif(p_client_request_id, '') || ':extra', auth.uid());
    end if;

    if coalesce(p_payment, 0) > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values
            (v_ledger_id, 'payment', p_payment, p_payment_desc, p_entry_date,
             nullif(p_client_request_id, '') || ':pay', auth.uid());
    end if;

    if p_note is not null then
        update public.monthly_ledger
           set notes = case
                         when notes is null or btrim(notes) = '' then p_note
                         else notes || E'\n' || p_note
                       end
         where id = v_ledger_id;
    end if;

    select * into v_row from public.monthly_ledger where id = v_ledger_id;
    return v_row;
end $$;

-- Hatalı hareketi ters kayıtla düzelt (silmek yerine iz bırakarak)
create or replace function public.reverse_entry(p_entry_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_e   public.ledger_entries%rowtype;
    v_new uuid;
begin
    select * into v_e from public.ledger_entries where id = p_entry_id;
    if not found then
        raise exception 'Hareket bulunamadı: %', p_entry_id;
    end if;

    perform public.assert_site_access(
        (select m.site_id from public.monthly_ledger m where m.id = v_e.ledger_id));

    insert into public.ledger_entries
        (ledger_id, entry_type, amount, description, entry_date, reference_no, created_by)
    values (
        v_e.ledger_id,
        case v_e.entry_type
            when 'extra_charge' then 'discount'::entry_type
            when 'discount'     then 'extra_charge'::entry_type
            when 'payment'      then 'refund'::entry_type
            when 'refund'       then 'payment'::entry_type
        end,
        v_e.amount,
        coalesce(p_reason, 'Düzeltme') || ' — iptal edilen kayıt: ' || coalesce(v_e.description, v_e.id::text),
        current_date,
        v_e.id::text,
        auth.uid()
    )
    returning id into v_new;

    return v_new;
end $$;

-- ---------------------------------------------------------------------
-- TOPLU TAHSİLAT (FIFO)  |  Müşteri birikmiş borcunu tek seferde öderse
-- ödeme en eski açık aydan başlanarak dağıtılır (muhasebe standardı).
-- ---------------------------------------------------------------------
create or replace function public.apply_payment_fifo(
    p_site_id     uuid,
    p_amount      numeric,
    p_entry_date  date default current_date,
    p_description text default null
)
returns table (period date, applied numeric, remaining_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_left numeric(14,2) := p_amount;
    v_rec  record;
    v_pay  numeric(14,2);
    v_last uuid;
begin
    perform public.assert_site_access(p_site_id);

    if p_amount is null or p_amount <= 0 then
        raise exception 'Tahsilat tutarı sıfırdan büyük olmalı.';
    end if;

    for v_rec in
        select id, m.period as p, balance
          from public.monthly_ledger m
         where m.site_id = p_site_id
           and m.balance > 0
           and m.is_locked = false
         order by m.period asc
    loop
        exit when v_left <= 0;
        v_pay  := least(v_left, v_rec.balance);
        v_left := v_left - v_pay;
        v_last := v_rec.id;

        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, created_by)
        values
            (v_rec.id, 'payment', v_pay,
             coalesce(p_description, 'Toplu tahsilat dağıtımı'), p_entry_date, auth.uid());

        period := v_rec.p;
        applied := v_pay;
        select balance into remaining_balance from public.monthly_ledger where id = v_rec.id;
        return next;
    end loop;

    -- Borcu aşan kısım avans olarak en güncel döneme yazılır
    if v_left > 0 then
        select id into v_last
          from public.monthly_ledger
         where site_id = p_site_id and is_locked = false
         order by period desc limit 1;

        if v_last is null then
            raise exception 'Bu site için açık dönem yok; önce dönem açın.';
        end if;

        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, created_by)
        values (v_last, 'payment', v_left,
                coalesce(p_description, 'Avans / fazla ödeme'), p_entry_date, auth.uid());

        select m.period, v_left, m.balance into period, applied, remaining_balance
          from public.monthly_ledger m where m.id = v_last;
        return next;
    end if;
end $$;

-- ---------------------------------------------------------------------
-- ZAM YÖNETİMİ  |  Yeni ücret sadece belirtilen dönem ve SONRASI için
-- geçerlidir. Geçmiş aylara ASLA dokunulmaz (eski Excel'in hatası buydu).
-- ---------------------------------------------------------------------
create or replace function public.set_site_fee(
    p_site_id          uuid,
    p_new_fee          numeric,
    p_effective_period date default date_trunc('month', current_date)::date
)
returns table (updated_periods int)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period date := date_trunc('month', p_effective_period)::date;
    v_cnt    int;
begin
    perform public.assert_site_access(p_site_id);

    if p_new_fee < 0 then
        raise exception 'Ücret negatif olamaz.';
    end if;

    update public.sites
       set monthly_fee = p_new_fee, updated_at = now()
     where id = p_site_id;

    with upd as (
        update public.monthly_ledger
           set base_fee = p_new_fee, updated_at = now()
         where site_id = p_site_id
           and period >= v_period
           and is_locked = false
        returning 1
    )
    select count(*) into v_cnt from upd;

    return query select v_cnt;
end $$;

-- ---------------------------------------------------------------------
-- DÖNEM KAPATMA / AÇMA
-- ---------------------------------------------------------------------
create or replace function public.close_period(p_module module_type, p_period date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_cnt int;
begin
    perform public.assert_module_access(p_module);

    with upd as (
        update public.monthly_ledger
           set is_locked = true, locked_at = now(), locked_by = auth.uid()
         where module = p_module
           and period = date_trunc('month', p_period)::date
           and is_locked = false
        returning 1
    )
    select count(*) into v_cnt from upd;
    return v_cnt;
end $$;

create or replace function public.reopen_period(p_module module_type, p_period date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_cnt int;
begin
    if not exists (select 1 from public.profiles
                    where id = auth.uid() and role = 'admin') then
        raise exception 'Kapalı dönemi yalnızca yönetici (admin) açabilir.';
    end if;

    with upd as (
        update public.monthly_ledger
           set is_locked = false, locked_at = null, locked_by = null
         where module = p_module
           and period = date_trunc('month', p_period)::date
           and is_locked = true
        returning 1
    )
    select count(*) into v_cnt from upd;
    return v_cnt;
end $$;

-- ---------------------------------------------------------------------
-- DENETİM İZİ (audit trail)
-- ---------------------------------------------------------------------
create or replace function public.trg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    values (
        tg_table_name,
        case when tg_op = 'DELETE' then (old.id)::uuid else (new.id)::uuid end,
        tg_op,
        case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
        case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
        auth.uid()
    );
    return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_audit_sites
    after insert or update or delete on public.sites
    for each row execute function public.trg_audit();

create trigger trg_audit_entries
    after insert or update or delete on public.ledger_entries
    for each row execute function public.trg_audit();

-- Yeni kullanıcı kaydolduğunda profil satırı otomatik açılır
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
    return new;
end $$;

create trigger trg_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
