-- =====================================================================
-- ELEVATOR360  |  0006_period_automation.sql
-- Dönem otomasyonu + site çıkarma (sözleşme sonlandırma) mantığı
-- ---------------------------------------------------------------------
-- ÇÖZDÜĞÜ İKİ SORUN
--  A) "Her ay siteleri tek tek elle girmeyeyim; liste kendi gelsin,
--      ben sadece o ayın ekleme/çıkarmasını yapayım."
--     -> ensure_current_period(): eksik ayları otomatik açar.
--     -> Yeni eklenen site, cari ayın listesine kendiliğinden düşer.
--
--  B) "Bir siteyi çıkardığımda GEÇMİŞ aylardan da siliniyordu."
--     -> deactivate_site(): sözleşmeyi belirtilen aydan İTİBAREN kapatır.
--        Geçmiş aylara dokunmaz. Sadece ileriye dönük, HİÇ HAREKET
--        GÖRMEMİŞ boş satırları temizler. Hareketi/ödemesi olan hiçbir
--        satır silinmez — silinmek istense bile fonksiyon reddeder.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) open_period: artık sözleşme başlangıç/bitiş tarihine saygı duyar
--    Sözleşmesi Mart'ta biten site Nisan listesinde ÇIKMAZ,
--    ama Mart ve öncesi bilançosu yerinde durur.
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
      from public.sites s
     where s.module = p_module
       and s.contract_status = 'active'
       and (s.contract_start is null or date_trunc('month', s.contract_start)::date <= v_period)
       and (s.contract_end   is null or date_trunc('month', s.contract_end)::date   >= v_period);

    with ins as (
        insert into public.monthly_ledger (site_id, module, period, base_fee)
        select s.id, s.module, v_period, s.monthly_fee
          from public.sites s
         where s.module = p_module
           and s.contract_status = 'active'
           and (s.contract_start is null or date_trunc('month', s.contract_start)::date <= v_period)
           and (s.contract_end   is null or date_trunc('month', s.contract_end)::date   >= v_period)
        on conflict (site_id, period) do nothing
        returning 1
    )
    select count(*) into v_created from ins;

    return query select v_created, (v_total - v_created);
end $$;

-- ---------------------------------------------------------------------
-- 2) ensure_current_period: "listeyi ben açmayayım, kendisi gelsin"
--    Son açılmış dönemden bugüne kadarki TÜM eksik ayları açar.
--    Uygulama her açılışta / liste her yüklendiğinde çağırır; zaten
--    açık aylar için hiçbir şey yapmaz (idempotent, ucuz).
--    Üç ay uygulamaya girilmese bile dönüşte eksik aylar tamamlanır.
-- ---------------------------------------------------------------------
create or replace function public.ensure_current_period(p_module module_type)
returns table (opened_period date, created_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current date := date_trunc('month', current_date)::date;
    v_start   date;
    v_p       date;
    v_cnt     int;
begin
    perform public.assert_module_access(p_module);

    select coalesce(max(period), v_current) into v_start
      from public.monthly_ledger where module = p_module;

    if v_start > v_current then          -- ileri tarihli dönem varsa geriye taşma yok
        v_start := v_current;
    end if;

    for v_p in select generate_series(v_start, v_current, interval '1 month')::date loop
        select o.created_count into v_cnt from public.open_period(p_module, v_p) o;
        if v_cnt > 0 then
            opened_period := v_p;
            created_count := v_cnt;
            return next;
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Yeni site eklendiğinde cari ayın satırı kendiliğinden açılır
--    (ay ortasında sözleşme yapılan site listede hemen görünür)
-- ---------------------------------------------------------------------
create or replace function public.trg_site_open_current_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_period date := date_trunc('month', current_date)::date;
begin
    if new.contract_status = 'active'
       and (new.contract_start is null or date_trunc('month', new.contract_start)::date <= v_period)
       and (new.contract_end   is null or date_trunc('month', new.contract_end)::date   >= v_period)
    then
        insert into public.monthly_ledger (site_id, module, period, base_fee)
        values (new.id, new.module, v_period, new.monthly_fee)
        on conflict (site_id, period) do nothing;
    end if;
    return new;
end $$;

create trigger trg_sites_open_period
    after insert on public.sites
    for each row execute function public.trg_site_open_current_period();

-- ---------------------------------------------------------------------
-- 4) SİTE ÇIKARMA  |  deactivate_site
--    p_effective_period: hangi aydan İTİBAREN listede çıkmasın
--    (varsayılan: gelecek ay — cari ayın hizmeti zaten verilmiş olur)
--
--    GARANTİ: p_effective_period'DAN ÖNCEKİ hiçbir satıra dokunulmaz.
--    Temizlenen satırlar yalnızca: hiç hareketi olmayan, tahsilatı
--    olmayan, ekstrası olmayan, kilitli olmayan BOŞ tahakkuklardır.
--    Hareket görmüş bir ay varsa silinmez; fonksiyon bunu raporlar.
-- ---------------------------------------------------------------------
create or replace function public.deactivate_site(
    p_site_id          uuid,
    p_effective_period date default (date_trunc('month', current_date) + interval '1 month')::date,
    p_reason           text default null
)
returns table (
    removed_empty_periods int,
    kept_periods_with_data int,
    contract_end_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period date := date_trunc('month', p_effective_period)::date;
    v_end    date := (date_trunc('month', p_effective_period) - interval '1 day')::date;
    v_del    int;
    v_kept   int;
begin
    perform public.assert_site_access(p_site_id);

    -- Sözleşme, geçerlilik ayından bir gün önce biter. Site SİLİNMEZ.
    update public.sites
       set contract_status = 'passive',
           contract_end    = v_end,
           notes           = case
                               when p_reason is null then notes
                               when notes is null or btrim(notes) = '' then p_reason
                               else notes || E'\n' || p_reason
                             end,
           updated_at      = now()
     where id = p_site_id;

    -- İleriye dönük BOŞ tahakkukları kaldır (geçmişe asla dokunma)
    with del as (
        delete from public.monthly_ledger m
         where m.site_id = p_site_id
           and m.period >= v_period
           and m.is_locked = false
           and m.extra_total = 0
           and m.discount_total = 0
           and m.paid_total = 0
           and m.refund_total = 0
           and not exists (select 1 from public.ledger_entries e where e.ledger_id = m.id)
        returning 1
    )
    select count(*) into v_del from del;

    -- Hareket görmüş oldukları için korunan ileri dönemler
    select count(*) into v_kept
      from public.monthly_ledger m
     where m.site_id = p_site_id and m.period >= v_period;

    return query select v_del, v_kept, v_end;
end $$;

comment on function public.deactivate_site(uuid, date, text) is
    'Siteyi belirtilen aydan itibaren listeden çıkarır. Geçmiş bilanço satırlarına DOKUNMAZ.';

-- Sözleşmeyi yeniden başlat
create or replace function public.reactivate_site(
    p_site_id uuid,
    p_from_period date default date_trunc('month', current_date)::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.assert_site_access(p_site_id);

    update public.sites
       set contract_status = 'active',
           contract_end    = null,
           contract_start  = coalesce(contract_start, date_trunc('month', p_from_period)::date),
           updated_at      = now()
     where id = p_site_id;

    perform public.open_period(
        (select module from public.sites where id = p_site_id),
        date_trunc('month', p_from_period)::date);
end $$;

-- ---------------------------------------------------------------------
-- 5) TEK AYLIK MUAFİYET  |  waive_period_fee
--    "Bu ay bu siteye hizmet verilmedi, ücret alınmayacak."
--    Satır SİLİNMEZ; sabit ücret kadar indirim kaydı düşülür.
--    Böylece toplam sıfırlanır ama sebebi ve izi kalır.
-- ---------------------------------------------------------------------
create or replace function public.waive_period_fee(
    p_site_id uuid,
    p_period  date,
    p_reason  text default 'Bu ay hizmet verilmedi'
)
returns public.monthly_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id  uuid;
    v_amt numeric(14,2);
    v_row public.monthly_ledger%rowtype;
begin
    perform public.assert_site_access(p_site_id);

    v_id := public.ensure_ledger(p_site_id, p_period);

    -- Yalnızca SABİT bakım ücreti muaf tutulur. O aya girilmiş ekstra/parça
    -- tutarları aynen durur (parça verilmişse bedeli alınır) ve daha önce
    -- girilmiş indirimler tekrar düşülmez.
    select greatest(base_fee - discount_total, 0) into v_amt
      from public.monthly_ledger where id = v_id;

    if v_amt > 0 then
        insert into public.ledger_entries (ledger_id, entry_type, amount, description, created_by)
        values (v_id, 'discount', v_amt, p_reason, auth.uid());
    end if;

    select * into v_row from public.monthly_ledger where id = v_id;
    return v_row;
end $$;

-- ---------------------------------------------------------------------
-- 5b) İNDİRİM / İADE GİRİŞİ  |  post_adjustment
--     "Bu ay şu kadar indirim yaptık" ya da "fazla tahsilatı iade ettik".
--     post_transaction ile aynı mantık: yeni satır açmaz, mevcut ayın
--     içine ters yönlü hareket yazar, toplam otomatik düzelir.
-- ---------------------------------------------------------------------
create or replace function public.post_adjustment(
    p_site_id           uuid,
    p_period            date,
    p_discount          numeric default 0,   -- borcu azaltır
    p_discount_desc     text    default null,
    p_refund            numeric default 0,   -- tahsilatı azaltır (para iadesi)
    p_refund_desc       text    default null,
    p_entry_date        date    default current_date,
    p_client_request_id text    default null
)
returns public.monthly_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id  uuid;
    v_row public.monthly_ledger%rowtype;
begin
    perform public.assert_site_access(p_site_id);

    if coalesce(p_discount,0) < 0 or coalesce(p_refund,0) < 0 then
        raise exception 'Tutarlar negatif olamaz.';
    end if;
    if coalesce(p_discount,0) = 0 and coalesce(p_refund,0) = 0 then
        raise exception 'İşlem boş: indirim ya da iade tutarı girilmeli.';
    end if;

    v_id := public.ensure_ledger(p_site_id, p_period);

    if coalesce(p_discount,0) > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values (v_id, 'discount', p_discount, coalesce(p_discount_desc,'İndirim'), p_entry_date,
                nullif(p_client_request_id,'') || ':disc', auth.uid());
    end if;

    if coalesce(p_refund,0) > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values (v_id, 'refund', p_refund, coalesce(p_refund_desc,'İade'), p_entry_date,
                nullif(p_client_request_id,'') || ':ref', auth.uid());
    end if;

    select * into v_row from public.monthly_ledger where id = v_id;
    return v_row;
end $$;

-- ---------------------------------------------------------------------
-- 6) Bilanço satırı silinirse iz kalsın (audit)
-- ---------------------------------------------------------------------
create trigger trg_audit_ledger
    after insert or update or delete on public.monthly_ledger
    for each row execute function public.trg_audit();

-- ---------------------------------------------------------------------
-- 7) Yetkiler
-- ---------------------------------------------------------------------
revoke all on function public.ensure_current_period(module_type)        from public, anon;
revoke all on function public.deactivate_site(uuid, date, text)         from public, anon;
revoke all on function public.reactivate_site(uuid, date)               from public, anon;
revoke all on function public.waive_period_fee(uuid, date, text)        from public, anon;

grant execute on function public.ensure_current_period(module_type)     to authenticated;
grant execute on function public.deactivate_site(uuid, date, text)      to authenticated;
grant execute on function public.reactivate_site(uuid, date)            to authenticated;
grant execute on function public.waive_period_fee(uuid, date, text)     to authenticated;

revoke all    on function public.post_adjustment(uuid, date, numeric, text, numeric, text, date, text) from public, anon;
grant execute on function public.post_adjustment(uuid, date, numeric, text, numeric, text, date, text) to authenticated;
