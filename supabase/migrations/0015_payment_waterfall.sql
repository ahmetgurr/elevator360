-- =====================================================================
-- ELEVATOR360  |  0015_payment_waterfall.sql
-- Otomatik Şelale (Waterfall) Mahsuplaşma Algoritması
-- ---------------------------------------------------------------------
-- SORUN: Esnaf Hızlı Kayıt ekranında GÖRÜNTÜLEDİĞİ aya toplu bir tutar
-- girdiğinde (ör. 2.500 ₺), bu tutarın TAMAMI o TEK aya yazılıyordu —
-- esnaf kafadan "önce bu ayı kapat, kalanı geçmişe say" hesabını KENDİSİ
-- yapmak zorunda kalıyordu.
--
-- ÇÖZÜM — 3 KURALLI ŞELALE DAĞITIMI (allocate_payment_waterfall):
--   1) ÖNCELİK: Girilen tutar ÖNCE görüntülenen (güncel) ayın KENDİ kalan
--      borcunu kapatır. Bu borç sabit aidat + o ay girilmiş ekstra
--      hizmeti/malzemeyi DAHİL eder (post_transaction, extra_charge
--      kaydını waterfall'dan ÖNCE işler — bkz. aşağıda).
--   2) KALAN varsa, AYNI siteye ait GEÇMİŞ (bu donemden ÖNCEKİ), açık
--      borcu olan aylara EN ESKİDEN YENİYE doğru dağıtılır.
--   3) Hâlâ para artarsa (tüm borçlar kapandıysa), kalan avans/fazla
--      ödeme olarak GÜNCEL (görüntülenen) aya yazılır.
--   KİLİTLİ (is_locked) ve PASİFE ALINMIŞ (is_skipped) aylar KESİNLİKLE
--   atlanır — hiçbir dağıtım bu aylara yapılmaz.
--
-- Not: apply_payment_fifo() (0002) bu fonksiyondan FARKLIDIR — o SAF
-- kronolojik FIFO'dur (güncel ay dahil en eskiden başlar) ve hiçbir
-- ekranda kullanılmıyor; DOKUNULMADI. Bu fonksiyon ise "önce güncel ayı
-- kapat, sonra geçmişe yay" iş kuralını uygular ve post_transaction()
-- (Hızlı Kayıt) tarafından çağrılır.
-- =====================================================================

create or replace function public.allocate_payment_waterfall(
    p_site_id            uuid,
    p_period             date,               -- goruntulenen (guncel) donem
    p_amount             numeric,
    p_entry_date         date default current_date,
    p_description        text default null,
    p_client_request_id  text default null   -- cift dokunma kalkani (her satir icin benzersizlestirilir)
)
returns table (ledger_id uuid, period date, applied numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period      date := date_trunc('month', p_period)::date;
    v_left        numeric(14,2) := p_amount;
    v_current_id  uuid;
    v_current_bal numeric(14,2);
    v_rec         record;
    v_pay         numeric(14,2);
begin
    perform public.assert_site_access(p_site_id);

    if p_amount is null or p_amount <= 0 then
        raise exception 'Tahsilat tutarı sıfırdan büyük olmalı.';
    end if;

    v_current_id := public.ensure_ledger(p_site_id, v_period);

    select balance into v_current_bal
      from public.monthly_ledger
     where id = v_current_id;

    -- 1) ÖNCELİK: güncel ayın KENDİ kalan borcu (ekstra dahil — caller bu
    -- fonksiyonu extra_charge kaydından SONRA cagirmalidir).
    if v_current_bal > 0 and v_left > 0 then
        v_pay := least(v_left, v_current_bal);
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values (v_current_id, 'payment', v_pay,
                coalesce(p_description, 'Tahsilat'), p_entry_date,
                nullif(p_client_request_id, '') || ':pay:current', auth.uid());
        v_left := v_left - v_pay;
        ledger_id := v_current_id; period := v_period; applied := v_pay;
        return next;
    end if;

    -- 2) KALAN varsa GEÇMİŞ (bu donemden ONCEKI), acik borclu, kilitli
    -- OLMAYAN ve pasife alinmamis (is_skipped) aylara EN ESKIDEN YENIYE
    -- dagitilir.
    if v_left > 0 then
        for v_rec in
            select m.id, m.period as p, m.balance
              from public.monthly_ledger m
             where m.site_id   = p_site_id
               and m.period    < v_period
               and m.balance   > 0
               and m.is_locked  = false
               and m.is_skipped = false
             order by m.period asc
        loop
            exit when v_left <= 0;
            v_pay := least(v_left, v_rec.balance);
            insert into public.ledger_entries
                (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
            values (v_rec.id, 'payment', v_pay,
                    coalesce(p_description, 'Tahsilat (geçmiş aya mahsup)'), p_entry_date,
                    nullif(p_client_request_id, '') || ':pay:' || to_char(v_rec.p, 'YYYYMM'), auth.uid());
            v_left := v_left - v_pay;
            ledger_id := v_rec.id; period := v_rec.p; applied := v_pay;
            return next;
        end loop;
    end if;

    -- 3) Tum borclar (guncel + gecmis) kapandi ve hala para artiyorsa:
    -- avans/fazla odeme GUNCEL aya yazilir (esnafin az once girdigi
    -- ekranda gorunmesi en sezgiseli).
    if v_left > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values (v_current_id, 'payment', v_left,
                coalesce(p_description, 'Avans / fazla ödeme'), p_entry_date,
                nullif(p_client_request_id, '') || ':pay:advance', auth.uid());
        ledger_id := v_current_id; period := v_period; applied := v_left;
        return next;
    end if;
end $$;

comment on function public.allocate_payment_waterfall(uuid, date, numeric, date, text, text) is
    'Otomatik şelale mahsuplaşma: önce görüntülenen ayın kendi borcunu (ekstra dahil), sonra kalanı geçmiş açık aylara en eskiden yeniye dağıtır, kilitli/pasife alınmış ayları atlar, artan avansı güncel aya yazar. post_transaction() tarafından çağrılır.';

revoke all on function public.allocate_payment_waterfall(uuid, date, numeric, date, text, text) from public, anon;
grant execute on function public.allocate_payment_waterfall(uuid, date, numeric, date, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- post_transaction  |  Hızlı Kayıt artık odemeyi TEK doneme degil,
-- allocate_payment_waterfall() araciligiyla dagitir.
-- Kolon SIRASI/imzasi DEGISMEDI — CREATE OR REPLACE FUNCTION guvenlidir.
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

    -- Ekstra ÖNCE islenir: waterfall, guncel ayin kalan borcunu
    -- hesaplarken bu ekstrayi ZATEN icermelidir (bkz. kullanici talebi:
    -- "Kritik Ekstra Gider Kontrolü").
    if coalesce(p_extra, 0) > 0 then
        insert into public.ledger_entries
            (ledger_id, entry_type, amount, description, entry_date, client_request_id, created_by)
        values
            (v_ledger_id, 'extra_charge', p_extra, p_extra_desc, p_entry_date,
             nullif(p_client_request_id, '') || ':extra', auth.uid());
    end if;

    if coalesce(p_payment, 0) > 0 then
        perform public.allocate_payment_waterfall(
            p_site_id, p_period, p_payment, p_entry_date, p_payment_desc, p_client_request_id
        );
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

comment on function public.post_transaction(uuid, date, numeric, text, numeric, text, date, text, text) is
    '"İlave İşlem / Ödeme Ekle" modalının tek çağrısı. Ödeme artık TEK bir aya yazılmaz — allocate_payment_waterfall() ile önce güncel ay (ekstra dahil), sonra geçmiş açık aylar en eskiden yeniye kapatılır (bkz. 0015_payment_waterfall.sql).';
