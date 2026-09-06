-- =====================================================================
-- ELEVATOR360  |  0012_security_hardening.sql
-- FAZ 1: Backend / Supabase güvenlik sıkılaştırması (OWASP Top 10 odaklı)
-- ---------------------------------------------------------------------
-- Bu migration'ın kapsamı SADECE denetim sonucu bulunan gerçek açıkları
-- kapatmaktır — mevcut RLS/GRANT/trigger mimarisi (0001-0011) baştan
-- itibaren zaten sağlam kurulmuş (tüm tablolarda RLS aktif, tüm
-- SECURITY DEFINER fonksiyonlar search_path sabitliyor ve kendi yetki
-- kontrolünü yapıyor, dinamik SQL/string-concat hiçbir yerde yok — bu
-- yüzden klasik "SQL injection" veya "RLS kapalı" tipi bir açık
-- BULUNAMADI). Aşağıdaki 4 bölüm, denetimde bulunan somut boşlukları
-- kapatır:
--
--   A) SÜTUN BAZLI YETKİ SIZINTISI (Broken Access Control / OWASP A01)
--      sites tablosunda TÜM sütunlara UPDATE izni açıktı. Uygulama kodu
--      ücret (monthly_fee) ve sözleşme alanlarını (contract_status/
--      start/end) HER ZAMAN set_site_fee() / deactivate_site() /
--      reactivate_site() / set_site_start_period() RPC'leri üzerinden
--      değiştiriyor (bkz. api.ts) — ama ham REST API'ye (PostgREST)
--      geçerli bir oturumla doğrudan istek atan biri bu RPC'leri atlayıp
--      monthly_fee'yi anlık değiştirebilir, geçmiş ayların base_fee
--      snapshot'ını bozmadan iş kuralını (zam sadece ileriye dönük
--      işler) delebilirdi. Çözüm: UPDATE yetkisi sadece uygulamanın
--      GERÇEKTEN doğrudan yazdığı sütunlarla (name, notes) sınırlanır.
--
--   B) GEREKSİZ YETKİ (Least Privilege)
--      profiles tablosuna authenticated için INSERT yetkisi açıktı;
--      istemci kodu profiles'a HİÇBİR ZAMAN insert yapmıyor (kayıt,
--      handle_new_user() trigger'ı ile SECURITY DEFINER olarak, RLS'i
--      atlayarak oluşuyor). RLS zaten bunu engelliyordu ama fazladan
--      duran bir GRANT, ileride bir politika hatasında son savunma
--      hattını kaldırır — kullanılmayan yetki geri alınır.
--
--   C) VERİ BÜTÜNLÜĞÜ  |  CHECK constraint'ler
--      Tutarlarda (>=0/>0) zaten sıkı constraint'ler vardı (0001).
--      Eksik olan: mantıksız TARİHLER (yıl 1 ya da yıl 9999 gibi) ve
--      SINIRSIZ UZUNLUKTA metin (bir saldırganın REST API'ye devasa bir
--      "notes" stringi göndererek depolamayı şişirmesi) hiçbir yerde
--      engellenmiyordu. NOT VALID ile eklenir — mevcut satırları
--      TARAMAZ/BOZMAZ, yalnızca BUNDAN SONRAKİ yazmaları sıkılaştırır
--      (canlıda sıfır kesinti). İsterseniz sakin bir zamanda ayrıca
--      `validate constraint` çalıştırabilirsiniz (bu dosyanın sonunda
--      yorum satırı olarak bırakıldı).
--
--   D) VERİTABANI DÖNGÜ KORUMASI
--      ensure_current_period(), en son açılmış dönemden BUGÜNE kadar
--      generate_series ile ay ay dönüyor — sınırsız. set_site_fee ile
--      AYNI kod tabanındaki set_site_start_period() ve useCreateSite
--      (istemci) zaten "guard < 600" desenini kullanıyordu; bu fonksiyon
--      gözden kaçmış. Biri monthly_ledger'a (ensure_ledger RPC'si ile)
--      çok eski bir period (ör. yıl 1) satırı açabilirse, sonraki
--      ensure_current_period çağrısı binlerce ay için gereksiz INSERT
--      denemesi yapar (performans darboğazı / kaynak tüketimi). Aynı
--      600 ay (50 yıl) sınırı eklenir; C bölümündeki period constraint'i
--      zaten bu senaryonun kaynağını da ayrıca kapatıyor (savunma
--      derinliği — iki katman).
-- =====================================================================


-- =====================================================================
-- A) sites — UPDATE yetkisi sadece dogrudan yazilan sutunlarla sinirlanir
-- =====================================================================
revoke update on public.sites from authenticated;
grant  update (name, notes) on public.sites to authenticated;

comment on column public.sites.monthly_fee is
    'GÜNCEL aylık ücret. Geçmiş aylar bu değerden ETKİLENMEZ; her ay kendi base_fee snapshot''ını taşır. '
    'YAZMA: sadece set_site_fee() RPC''si üzerinden — tabloya doğrudan UPDATE yetkisi authenticated''dan kaldırılmıştır (bkz. 0012).';


-- =====================================================================
-- B) profiles — kullanilmayan INSERT yetkisi geri alinir
-- =====================================================================
revoke insert on public.profiles from authenticated;
-- profiles satırı YALNIZCA handle_new_user() trigger'ı (SECURITY DEFINER,
-- auth.users INSERT'ine bağlı) tarafından açılır — istemci tarafında bir
-- profil INSERT akışı yoktur ve olmamalıdır.


-- =====================================================================
-- C) Veri bütünlüğü: mantıksız tarih / sınırsız metin uzunluğu
-- NOT VALID: mevcut satırlar taranmaz, sadece yeni yazmalar denetlenir.
-- =====================================================================

-- --- Tarihler: makul bir aralık dışına çıkamaz -----------------------
alter table public.monthly_ledger
    add constraint ledger_period_sane
    check (period >= date '2015-01-01' and period <= (current_date + interval '5 years'))
    not valid;

alter table public.ledger_entries
    add constraint entries_date_sane
    check (entry_date >= date '2015-01-01' and entry_date <= (current_date + interval '5 years'))
    not valid;

alter table public.sites
    add constraint sites_contract_start_sane
    check (contract_start is null
           or (contract_start >= date '2015-01-01' and contract_start <= (current_date + interval '10 years')))
    not valid;

alter table public.sites
    add constraint sites_contract_end_sane
    check (contract_end is null
           or (contract_end >= date '2015-01-01' and contract_end <= (current_date + interval '10 years')))
    not valid;

-- --- Metin alanları: makul üst sınır (depolama/DoS istismarına karşı) --
-- btrim: sadece bosluklardan olusan bir isim (dogrudan REST cagrisiyla
-- istemcinin kendi .trim()'ini atlayarak gonderilse bile) gecmez.
alter table public.sites
    add constraint sites_name_len     check (char_length(btrim(name)) between 1 and 200) not valid;
alter table public.sites
    add constraint sites_notes_len    check (notes is null or char_length(notes) <= 4000) not valid;
alter table public.sites
    add constraint sites_address_len  check (address is null or char_length(address) <= 500) not valid;
alter table public.sites
    add constraint sites_contact_name_len  check (contact_name  is null or char_length(contact_name)  <= 200) not valid;
alter table public.sites
    add constraint sites_contact_phone_len check (contact_phone is null or char_length(contact_phone) <= 50)  not valid;

alter table public.monthly_ledger
    add constraint ledger_notes_len check (notes is null or char_length(notes) <= 4000) not valid;

alter table public.ledger_entries
    add constraint entries_description_len   check (description   is null or char_length(description)   <= 1000) not valid;
alter table public.ledger_entries
    add constraint entries_reference_no_len  check (reference_no  is null or char_length(reference_no)  <= 200)  not valid;
alter table public.ledger_entries
    add constraint entries_client_request_id_len check (client_request_id is null or char_length(client_request_id) <= 200) not valid;

alter table public.profiles
    add constraint profiles_full_name_len check (char_length(btrim(full_name)) between 1 and 200) not valid;


-- =====================================================================
-- D) ensure_current_period — sinirsiz dongu korumasi (guard < 600 ay)
-- Diger tum "gecmise donuk ay acma" dongulerinde (set_site_start_period,
-- useCreateSite istemci kodu) zaten kullanilan desenle birebir aynidir.
-- =====================================================================
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
    v_guard   int := 0;
begin
    perform public.assert_module_access(p_module);

    select coalesce(max(period), v_current) into v_start
      from public.monthly_ledger where module = p_module;

    if v_start > v_current then          -- ileri tarihli dönem varsa geriye taşma yok
        v_start := v_current;
    end if;

    v_p := v_start;
    while v_p <= v_current and v_guard < 600 loop
        select o.created_count into v_cnt from public.open_period(p_module, v_p) o;
        if v_cnt > 0 then
            opened_period := v_p;
            created_count := v_cnt;
            return next;
        end if;
        v_p := (v_p + interval '1 month')::date;
        v_guard := v_guard + 1;
    end loop;
end $$;

-- =====================================================================
-- Daha sonra, sakin bir zamanda (canli trafigi etkilemez, sadece mevcut
-- satirlari bir kez tarar) mevcut verinin de yeni kurallara uydugunu
-- dogrulamak isterseniz asagidakileri TEK TEK calistirabilirsiniz:
--
--   alter table public.monthly_ledger validate constraint ledger_period_sane;
--   alter table public.ledger_entries validate constraint entries_date_sane;
--   alter table public.sites          validate constraint sites_contract_start_sane;
--   alter table public.sites          validate constraint sites_contract_end_sane;
--   alter table public.sites          validate constraint sites_name_len;
--   alter table public.sites          validate constraint sites_notes_len;
--   alter table public.sites          validate constraint sites_address_len;
--   alter table public.sites          validate constraint sites_contact_name_len;
--   alter table public.sites          validate constraint sites_contact_phone_len;
--   alter table public.monthly_ledger validate constraint ledger_notes_len;
--   alter table public.ledger_entries validate constraint entries_description_len;
--   alter table public.ledger_entries validate constraint entries_reference_no_len;
--   alter table public.ledger_entries validate constraint entries_client_request_id_len;
--   alter table public.profiles       validate constraint profiles_full_name_len;
--
-- Bir tanesi mevcut veriyle celisirse hata verir ve HANGI satirin
-- sorunlu oldugunu soyler; o satiri elle duzeltip tekrar deneyebilirsiniz.
-- =====================================================================
