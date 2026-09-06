-- =====================================================================
-- ELEVATOR360  |  0004_rls.sql
-- Row Level Security + kolon bazlı yetkiler
-- ---------------------------------------------------------------------
-- İKİ KATMANLI KORUMA
--  1) RLS  : kullanıcı yalnızca yetkili olduğu modülün satırlarını görür.
--  2) GRANT: monthly_ledger'ın TUTAR kolonları hiçbir kullanıcıya yazma
--            yetkisi ile açılmaz. Tutarlar sadece trigger/fonksiyon
--            üzerinden değişir — uygulamada bir hata olsa bile bilanço
--            elle bozulamaz.
-- =====================================================================

alter table public.profiles       enable row level security;
alter table public.sites          enable row level security;
alter table public.monthly_ledger enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_log      enable row level security;

-- Rol yardımcısı (RLS içinde profiles'a bakarken sonsuz döngüyü önler)
create or replace function public.current_app_role()
returns user_role
language sql stable security definer set search_path = public as $$
    select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.can_write()
returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce(public.current_app_role() in ('admin','operator'), false)
$$;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
create policy profiles_self_read on public.profiles
    for select to authenticated
    using (id = auth.uid() or public.is_admin());

create policy profiles_admin_write on public.profiles
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- SITES
-- ---------------------------------------------------------------------
create policy sites_read on public.sites
    for select to authenticated
    using (public.has_module(module));

create policy sites_insert on public.sites
    for insert to authenticated
    with check (public.has_module(module) and public.can_write());

create policy sites_update on public.sites
    for update to authenticated
    using (public.has_module(module) and public.can_write())
    with check (public.has_module(module) and public.can_write());

-- Site silme yok: sözleşme biterse contract_status = 'passive' yapılır.
-- (Geçmiş bilanço kayıtları bozulmasın diye monthly_ledger'da da
--  ON DELETE RESTRICT tanımlıdır.)

-- ---------------------------------------------------------------------
-- MONTHLY_LEDGER
-- ---------------------------------------------------------------------
create policy ledger_read on public.monthly_ledger
    for select to authenticated
    using (public.has_module(module));

-- Sadece not alanı ve kilit durumu; tutarlar GRANT ile korunuyor (aşağıda)
create policy ledger_update on public.monthly_ledger
    for update to authenticated
    using (public.has_module(module) and public.can_write() and is_locked = false)
    with check (public.has_module(module) and public.can_write());

-- INSERT politikası YOK: dönem satırları yalnızca open_period() /
-- ensure_ledger() fonksiyonları ile açılır. Böylece base_fee snapshot'ı
-- ve mükerrer kontrolü her zaman devrede kalır.

-- ---------------------------------------------------------------------
-- LEDGER_ENTRIES
-- ---------------------------------------------------------------------
create policy entries_read on public.ledger_entries
    for select to authenticated
    using (exists (select 1 from public.monthly_ledger m
                    where m.id = ledger_id and public.has_module(m.module)));

create policy entries_insert on public.ledger_entries
    for insert to authenticated
    with check (public.can_write()
                and exists (select 1 from public.monthly_ledger m
                             where m.id = ledger_id
                               and public.has_module(m.module)
                               and m.is_locked = false));

create policy entries_delete on public.ledger_entries
    for delete to authenticated
    using (public.can_write()
           and exists (select 1 from public.monthly_ledger m
                        where m.id = ledger_id
                          and public.has_module(m.module)
                          and m.is_locked = false));

-- Hareketler GÜNCELLENMEZ. Hata varsa satır silinir ya da reverse_entry()
-- ile ters kayıt atılır; her iki durumda da audit_log iz bırakır.

-- ---------------------------------------------------------------------
-- AUDIT_LOG  |  Yalnızca yönetici okur, kimse yazamaz/silemez
-- ---------------------------------------------------------------------
create policy audit_admin_read on public.audit_log
    for select to authenticated
    using (public.is_admin());

-- =====================================================================
-- KOLON BAZLI YETKİLER  |  Bilançoyu elle bozmayı imkânsız kılan katman
-- =====================================================================
revoke all on public.monthly_ledger from anon, authenticated;
grant  select on public.monthly_ledger to authenticated;
grant  update (notes) on public.monthly_ledger to authenticated;

revoke all on public.sites from anon;
grant  select, insert, update on public.sites to authenticated;

revoke all on public.ledger_entries from anon;
grant  select, insert, delete on public.ledger_entries to authenticated;

revoke all on public.audit_log from anon, authenticated;
grant  select on public.audit_log to authenticated;

revoke all on public.profiles from anon;
grant  select, insert, update on public.profiles to authenticated;

-- View'ler (security_invoker = on olduğu için RLS aynen uygulanır)
grant select on public.v_ledger, public.v_period_summary, public.v_site_receivables,
                public.v_aging, public.v_monthly_trend, public.v_entry_detail
      to authenticated;

-- ---------------------------------------------------------------------
-- FONKSİYON YETKİLERİ
-- ---------------------------------------------------------------------
revoke all on function public.open_period(module_type, date)                     from public, anon;
revoke all on function public.ensure_ledger(uuid, date)                          from public, anon;
revoke all on function public.post_transaction(uuid, date, numeric, text, numeric, text, date, text, text) from public, anon;
revoke all on function public.apply_payment_fifo(uuid, numeric, date, text)      from public, anon;
revoke all on function public.set_site_fee(uuid, numeric, date)                  from public, anon;
revoke all on function public.close_period(module_type, date)                    from public, anon;
revoke all on function public.reopen_period(module_type, date)                   from public, anon;
revoke all on function public.reverse_entry(uuid, text)                          from public, anon;
revoke all on function public.recalc_ledger(uuid)                                from public, anon;

grant execute on function public.open_period(module_type, date)                     to authenticated;
grant execute on function public.ensure_ledger(uuid, date)                          to authenticated;
grant execute on function public.post_transaction(uuid, date, numeric, text, numeric, text, date, text, text) to authenticated;
grant execute on function public.apply_payment_fifo(uuid, numeric, date, text)      to authenticated;
grant execute on function public.set_site_fee(uuid, numeric, date)                  to authenticated;
grant execute on function public.close_period(module_type, date)                    to authenticated;
grant execute on function public.reopen_period(module_type, date)                   to authenticated;
grant execute on function public.reverse_entry(uuid, text)                          to authenticated;
grant execute on function public.has_module(module_type)                            to authenticated;
