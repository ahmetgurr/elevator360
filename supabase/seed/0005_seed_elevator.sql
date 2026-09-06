-- =====================================================================
-- ELEVATOR360 | 0005_seed_elevator.sql  (otomatik üretildi)
-- Kaynak: old_data/Asansör - Final.xlsx
-- 108 site, 21 hareket kaydı
-- Tekrar çalıştırılabilir (idempotent): mükerrer kayıt oluşturmaz.
-- =====================================================================
begin;

-- ---- Siteler ----
insert into public.sites (module, code, name, monthly_fee, service_day, contract_status, notes) values
  ('elevator', 'AST-001', 'Baranlar', 10500.0, 5, 'active', null),
  ('elevator', 'AST-002', 'Bulvar Burhan', 1500.0, 10, 'active', null),
  ('elevator', 'AST-003', 'Palmiye Otel', 1500.0, 18, 'active', null),
  ('elevator', 'AST-004', 'Bozyel 4', 3000.0, 22, 'active', null),
  ('elevator', 'AST-005', 'Erdoğan', 1000.0, 5, 'active', null),
  ('elevator', 'AST-006', 'Feyzullah', 1000.0, 10, 'active', null),
  ('elevator', 'AST-007', 'Moda', 1400.0, 18, 'active', null),
  ('elevator', 'AST-008', 'Oteller', 3500.0, 22, 'active', null),
  ('elevator', 'AST-009', 'Dav. Hasan', 1000.0, 5, 'active', null),
  ('elevator', 'AST-010', 'Ali 3 Kat', 2000.0, 10, 'active', null),
  ('elevator', 'AST-011', 'Beta', 1500.0, 18, 'active', null),
  ('elevator', 'AST-012', 'Damla', 1000.0, 22, 'active', null),
  ('elevator', 'AST-013', 'Ankara Evleri', 3000.0, 5, 'active', null),
  ('elevator', 'AST-014', 'Şarabi', 1250.0, 10, 'active', null),
  ('elevator', 'AST-015', 'Huzur Evi', 2000.0, 18, 'active', null),
  ('elevator', 'AST-016', 'Azizoğlu 9', 1000.0, 22, 'active', null),
  ('elevator', 'AST-017', 'Demka', 1000.0, 5, 'active', null),
  ('elevator', 'AST-018', 'Durmuş Ünal', 1500.0, 10, 'active', null),
  ('elevator', 'AST-019', 'Fırat 1', 1300.0, 18, 'active', null),
  ('elevator', 'AST-020', 'Hikmet Yıldız', 1000.0, 22, 'active', null),
  ('elevator', 'AST-021', 'Fırat 3', 1350.0, 5, 'active', null),
  ('elevator', 'AST-022', 'Müjgan', 1500.0, 10, 'active', null),
  ('elevator', 'AST-023', 'Gökçün', 3500.0, 18, 'active', null),
  ('elevator', 'AST-024', 'Yürekli', 1200.0, 22, 'active', null),
  ('elevator', 'AST-025', 'Kökmen', 1250.0, 5, 'active', null),
  ('elevator', 'AST-026', 'Hacı Veli', 1000.0, 10, 'active', null),
  ('elevator', 'AST-027', 'Şahin Ant.', 1500.0, 18, 'active', null),
  ('elevator', 'AST-028', 'Uysal', 1500.0, 22, 'active', null),
  ('elevator', 'AST-029', 'Arıcam Polis', 3200.0, 5, 'active', null),
  ('elevator', 'AST-030', 'Fatma Aşkın', 1500.0, 10, 'active', null),
  ('elevator', 'AST-031', 'Güzelyurt', 3500.0, 18, 'active', null),
  ('elevator', 'AST-032', 'Darıkent', 1200.0, 22, 'active', null),
  ('elevator', 'AST-033', 'Ms Otel', 2000.0, 5, 'active', null),
  ('elevator', 'AST-034', 'Aras 18', 1400.0, 10, 'active', null),
  ('elevator', 'AST-035', 'D. Akış', 1500.0, 18, 'active', null),
  ('elevator', 'AST-036', '2000 Evler', 4200.0, 22, 'active', null),
  ('elevator', 'AST-037', 'Kayu Yolu', 3000.0, 5, 'active', null),
  ('elevator', 'AST-038', 'Beyza', 1500.0, 10, 'active', null),
  ('elevator', 'AST-039', 'Ataç Onur', 3000.0, 18, 'active', null),
  ('elevator', 'AST-040', 'Özgüven B', 1500.0, 22, 'active', null),
  ('elevator', 'AST-041', 'Helvacıoğlu', 1200.0, 5, 'active', null),
  ('elevator', 'AST-042', 'Cansu 1', 1000.0, 10, 'active', null),
  ('elevator', 'AST-043', 'Asil', 11000.0, 18, 'active', null),
  ('elevator', 'AST-044', 'Taşdelen 1', 1400.0, 22, 'active', null),
  ('elevator', 'AST-045', 'Özdemir 1', 1500.0, 5, 'active', null),
  ('elevator', 'AST-046', 'Viport', 3000.0, 10, 'active', null),
  ('elevator', 'AST-047', 'Hedef A-B', 2000.0, 18, 'active', null),
  ('elevator', 'AST-048', 'Fatma Kılıç', 1000.0, 22, 'active', null),
  ('elevator', 'AST-049', 'Aydın', 1500.0, 5, 'active', null),
  ('elevator', 'AST-050', 'Azizoğlu 2', 1500.0, 10, 'active', null),
  ('elevator', 'AST-051', 'Sağıroğlu', 1500.0, 18, 'active', null),
  ('elevator', 'AST-052', 'Mızrak 1', 1500.0, 22, 'active', null),
  ('elevator', 'AST-053', 'Görentaş', 1500.0, 5, 'active', null),
  ('elevator', 'AST-054', 'Işık 5', 1200.0, 10, 'active', null),
  ('elevator', 'AST-055', 'İnce', 1500.0, 18, 'active', null),
  ('elevator', 'AST-056', 'Meram 2', 1500.0, 22, 'active', null),
  ('elevator', 'AST-057', 'Cudi', 1000.0, 5, 'active', null),
  ('elevator', 'AST-058', 'Ersin 2', 1000.0, 10, 'active', null),
  ('elevator', 'AST-059', 'Paşalar', 1250.0, 18, 'active', null),
  ('elevator', 'AST-060', 'Özgüven C', 1500.0, 22, 'active', null),
  ('elevator', 'AST-061', 'Turan Dayı', 1500.0, 5, 'active', null),
  ('elevator', 'AST-062', 'İkizler', 1500.0, 10, 'active', null),
  ('elevator', 'AST-063', 'Arslan Yalınayak', 1250.0, 18, 'active', null),
  ('elevator', 'AST-064', 'Nihal', 1000.0, 22, 'active', null),
  ('elevator', 'AST-065', 'Batıhan', 1400.0, 5, 'active', null),
  ('elevator', 'AST-066', 'Sat', 1350.0, 10, 'active', null),
  ('elevator', 'AST-067', 'Hazner 1', 1500.0, 18, 'active', null),
  ('elevator', 'AST-068', 'Yeşilbelde', 1500.0, 22, 'active', null),
  ('elevator', 'AST-069', 'Çelik 1', 1500.0, 5, 'active', null),
  ('elevator', 'AST-070', 'Kuyuluk Plaza', 3000.0, 10, 'active', null),
  ('elevator', 'AST-071', 'Öz Ela 4', 1500.0, 18, 'active', null),
  ('elevator', 'AST-072', 'Köşem', 1300.0, 22, 'active', null),
  ('elevator', 'AST-073', 'Genç', 1300.0, 5, 'active', null),
  ('elevator', 'AST-074', 'Akdeniz Plaza', 3000.0, 10, 'active', null),
  ('elevator', 'AST-075', 'Taşkule', 1300.0, 18, 'active', null),
  ('elevator', 'AST-076', 'Aras 20', 1250.0, 22, 'active', null),
  ('elevator', 'AST-077', 'Melisa Park', 1500.0, 5, 'active', null),
  ('elevator', 'AST-078', 'Emsal 2', 3000.0, 10, 'active', null),
  ('elevator', 'AST-079', 'Sunay Kon.', 1300.0, 18, 'active', null),
  ('elevator', 'AST-080', 'Baykal', 1200.0, 22, 'active', null),
  ('elevator', 'AST-081', 'Sedefler', 9000.0, 5, 'active', null),
  ('elevator', 'AST-082', 'Öz Ela 3', 1500.0, 10, 'active', null),
  ('elevator', 'AST-083', 'Tece Ulaş', 4000.0, 18, 'active', null),
  ('elevator', 'AST-084', 'Kılıç 3', 1500.0, 22, 'active', null),
  ('elevator', 'AST-085', 'Tapan', 1500.0, 5, 'active', null),
  ('elevator', 'AST-086', 'Enster 8', 2600.0, 10, 'active', null),
  ('elevator', 'AST-087', 'Nova', 1250.0, 18, 'active', null),
  ('elevator', 'AST-088', 'Can', 1500.0, 22, 'active', null),
  ('elevator', 'AST-089', 'Şimşek', 1500.0, 5, 'active', null),
  ('elevator', 'AST-090', 'Bakkal Doğan', 1500.0, 10, 'active', null),
  ('elevator', 'AST-091', 'Hattat', 1500.0, 18, 'active', null),
  ('elevator', 'AST-092', 'Yıldız Toros', 1000.0, 22, 'active', null),
  ('elevator', 'AST-093', 'Özgül 3', 1920.0, 5, 'active', null),
  ('elevator', 'AST-094', 'Turkuaz Elit', 7200.0, 10, 'active', null),
  ('elevator', 'AST-095', 'Parkkent', 8000.0, 18, 'active', null),
  ('elevator', 'AST-096', 'Yasemin', 2000.0, 22, 'active', null),
  ('elevator', 'AST-097', 'Arıcan Fas', 2000.0, 5, 'active', null),
  ('elevator', 'AST-098', 'D. Ulaş', 1500.0, 10, 'active', null),
  ('elevator', 'AST-099', 'Cihan', 1400.0, 18, 'active', null),
  ('elevator', 'AST-100', 'Saime Akış', 3500.0, 22, 'active', null),
  ('elevator', 'AST-101', 'Deniz', 1400.0, 5, 'active', null),
  ('elevator', 'AST-102', 'Libel', 6800.0, 10, 'active', null),
  ('elevator', 'AST-103', 'Sevgi', 3000.0, 18, 'active', null),
  ('elevator', 'AST-104', 'Karatay', 1500.0, 22, 'active', null),
  ('elevator', 'AST-105', 'Aras 44', 1000.0, 5, 'active', null),
  ('elevator', 'AST-106', 'Hazner 3', 1440.0, 10, 'active', null),
  ('elevator', 'AST-107', 'HaziranDenemesi', 12.0, 12, 'active', '12'),
  ('elevator', 'AST-108', '[KAYIP SITE] AST-108 — eski sistemde tanimi yok', 0.0, null, 'passive', 'Eski sistemde bu koda ait hareket vardi ama site tanimi yoktu. Dogru siteyle eslestirip bu kaydi pasife alin.')
on conflict (module, code) do update set
    name = excluded.name, monthly_fee = excluded.monthly_fee,
    service_day = excluded.service_day, contract_status = excluded.contract_status;

-- ---- Dönem (bilanço) satırları ----
-- Geçmiş ve cari dönemler: aktif TÜM siteler için sabit ücret tahakkuku açılır.
-- Gelecek dönemler: sadece eski veride hareketi olan siteler için açılır,
-- aksi halde henüz doğmamış alacak bugünün raporlarını şişirirdi.
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, g.period::date, s.monthly_fee
  from public.sites s
  cross join generate_series(date '2026-03-01', date '2026-09-01', interval '1 month') as g(period)
  where s.module = 'elevator' and s.contract_status = 'active'
on conflict (site_id, period) do nothing;

insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-10-01', s.monthly_fee from public.sites s
  where s.module = 'elevator' and s.code in ('AST-011')
on conflict (site_id, period) do nothing;
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-11-01', s.monthly_fee from public.sites s
  where s.module = 'elevator' and s.code in ('AST-030')
on conflict (site_id, period) do nothing;
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-12-01', s.monthly_fee from public.sites s
  where s.module = 'elevator' and s.code in ('AST-006')
on conflict (site_id, period) do nothing;

-- ---- Kayip site kayitlarinin donemleri (tutarlar kaybolmasin diye) ----
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-03-01', 0 from public.sites s
  where s.module = 'elevator' and s.code = 'AST-108'
on conflict (site_id, period) do nothing;
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-05-01', 0 from public.sites s
  where s.module = 'elevator' and s.code = 'AST-108'
on conflict (site_id, period) do nothing;
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-06-01', 0 from public.sites s
  where s.module = 'elevator' and s.code = 'AST-108'
on conflict (site_id, period) do nothing;
insert into public.monthly_ledger (site_id, module, period, base_fee)
select s.id, s.module, date '2026-07-01', 0 from public.sites s
  where s.module = 'elevator' and s.code = 'AST-108'
on conflict (site_id, period) do nothing;

-- ---- Hareketler (ekstra / tahsilat) ----
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-007' and m.period = date '2026-04-01'), 'extra_charge', 4000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:ee87a714:extra_charge', 'legacy:ee87a714:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-007' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-007' and m.period = date '2026-04-01'), 'payment', 5400.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:ee87a714:payment', 'legacy:ee87a714:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-007' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'notlandı' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-007' and m.period = date '2026-04-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-008' and m.period = date '2026-04-01'), 'extra_charge', 1000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:f40e0622:extra_charge', 'legacy:f40e0622:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-008' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-008' and m.period = date '2026-04-01'), 'payment', 3000.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:f40e0622:payment', 'legacy:f40e0622:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-008' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-011' and m.period = date '2026-05-01'), 'extra_charge', 2000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:0aaf7cf3:extra_charge', 'legacy:0aaf7cf3:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-011' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-014' and m.period = date '2026-05-01'), 'extra_charge', 7777.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:2a787338:extra_charge', 'legacy:2a787338:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-014' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-014' and m.period = date '2026-05-01'), 'payment', 777.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:2a787338:payment', 'legacy:2a787338:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-014' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-011' and m.period = date '2026-10-01'), 'extra_charge', 100000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-10-01', 'legacy:3501e5ef:extra_charge', 'legacy:3501e5ef:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-011' and m.period = date '2026-10-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-006' and m.period = date '2026-12-01'), 'extra_charge', 12000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-12-01', 'legacy:e5e3e757:extra_charge', 'legacy:e5e3e757:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-006' and m.period = date '2026-12-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-105' and m.period = date '2026-05-01'), 'extra_charge', 25000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:1b5e4c69:extra_charge', 'legacy:1b5e4c69:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-105' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-105' and m.period = date '2026-05-01'), 'payment', 2400.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:1b5e4c69:payment', 'legacy:1b5e4c69:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-105' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'besıncı ay' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-105' and m.period = date '2026-05-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-030' and m.period = date '2026-11-01'), 'extra_charge', 11000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-11-01', 'legacy:383b36ab:extra_charge', 'legacy:383b36ab:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-030' and m.period = date '2026-11-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-030' and m.period = date '2026-11-01'), 'payment', 10.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-11-01', 'legacy:383b36ab:payment', 'legacy:383b36ab:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-030' and m.period = date '2026-11-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'Fatma aşkın' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-030' and m.period = date '2026-11-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-054' and m.period = date '2026-04-01'), 'extra_charge', 111111.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:dcd0e0c6:extra_charge', 'legacy:dcd0e0c6:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-054' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-054' and m.period = date '2026-04-01'), 'payment', 1.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-04-01', 'legacy:dcd0e0c6:payment', 'legacy:dcd0e0c6:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-054' and m.period = date '2026-04-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'birrrr' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-054' and m.period = date '2026-04-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-08-01'), 'extra_charge', 88888.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-08-01', 'legacy:3e5c8047:extra_charge', 'legacy:3e5c8047:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-08-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-08-01'), 'payment', 88.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-08-01', 'legacy:3e5c8047:payment', 'legacy:3e5c8047:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-08-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = '888.0' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-08-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-05-01'), 'extra_charge', 85000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:efec0086:extra_charge', 'legacy:efec0086:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-05-01'), 'payment', 2000.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:efec0086:payment', 'legacy:efec0086:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'Eksik yine' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-05-01');
update public.monthly_ledger set notes = '2222' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-006' and m.period = date '2026-05-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-09-01'), 'extra_charge', 11111.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-09-01', 'legacy:0a054225:extra_charge', 'legacy:0a054225:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-09-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-09-01'), 'payment', 11.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-09-01', 'legacy:0a054225:payment', 'legacy:0a054225:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-09-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-005' and m.period = date '2026-09-01'), 'extra_charge', 22.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-09-01', 'legacy:42c11ff9:extra_charge', 'legacy:42c11ff9:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-005' and m.period = date '2026-09-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-005' and m.period = date '2026-09-01'), 'payment', 22.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-09-01', 'legacy:42c11ff9:payment', 'legacy:42c11ff9:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-005' and m.period = date '2026-09-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-05-01'), 'extra_charge', 2111.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:5f2b8751:extra_charge', 'legacy:5f2b8751:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-05-01'), 'payment', 11.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-05-01', 'legacy:5f2b8751:payment', 'legacy:5f2b8751:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-05-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = '11' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-05-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-07-01'), 'extra_charge', 11.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-07-01', 'legacy:c485d095:extra_charge', 'legacy:c485d095:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-07-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-07-01'), 'payment', 10.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-07-01', 'legacy:c485d095:payment', 'legacy:c485d095:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-07-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'Dwnw' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-07-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-06-01'), 'extra_charge', 1.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:9b3b1e42:extra_charge', 'legacy:9b3b1e42:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-06-01'), 'payment', 1.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:9b3b1e42:payment', 'legacy:9b3b1e42:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = '1' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-06-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-03-01'), 'extra_charge', 8.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-03-01', 'legacy:05b00463:extra_charge', 'legacy:05b00463:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-03-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-03-01'), 'payment', 8.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-03-01', 'legacy:05b00463:payment', 'legacy:05b00463:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-108' and m.period = date '2026-03-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-044' and m.period = date '2026-06-01'), 'extra_charge', 5000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:636884a7:extra_charge', 'legacy:636884a7:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-044' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-044' and m.period = date '2026-06-01'), 'payment', 100000.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:636884a7:payment', 'legacy:636884a7:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-044' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-06-01'), 'extra_charge', 1000.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:30aefdf9:extra_charge', 'legacy:30aefdf9:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = '10000' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-001' and m.period = date '2026-06-01');
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-083' and m.period = date '2026-06-01'), 'extra_charge', 11111.0, 'Ekstra / parça (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:c514ae7c:extra_charge', 'legacy:c514ae7c:extra_charge'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-083' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)
select (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-083' and m.period = date '2026-06-01'), 'payment', 11111.0, 'Tahsilat (eski sistemden aktarıldı)', date '2026-06-01', 'legacy:c514ae7c:payment', 'legacy:c514ae7c:payment'
where (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-083' and m.period = date '2026-06-01') is not null
on conflict (client_request_id) do nothing;
update public.monthly_ledger set notes = 'yenı 12 haziran' where id = (select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id where s.module = 'elevator' and s.code = 'AST-083' and m.period = date '2026-06-01');

commit;

-- ---- MUTABAKAT: asagidaki sorgu Excel'deki ham toplamlari dogrulamalidir ----
-- Beklenen -> ekstra: 478151.00   tahsilat: 124850.00   site: 108
-- select sum(extra_total) as ekstra, sum(paid_total) as tahsilat, count(distinct site_id) as site
--   from public.monthly_ledger;
-- select * from public.v_period_summary where module = 'elevator' order by period;