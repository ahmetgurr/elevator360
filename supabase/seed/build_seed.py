# -*- coding: utf-8 -*-
"""
Eski AppSheet / Google Sheets verisini (Asansör - Final.xlsx) Supabase'e
yüklenebilir SQL'e çevirir.

Kullanım:
    python build_seed.py
Çıktı:
    0005_seed_elevator.sql   ->  Supabase SQL Editor'a yapıştırılıp çalıştırılır.

NOT: Elimizde tarihsel ücret bilgisi yok; geçmiş dönemlerin base_fee
snapshot'ı bugünkü ücretle doldurulur. Bundan SONRAKİ zamlar geçmişi
etkilemez (set_site_fee fonksiyonu bunu garanti eder).
"""
import os, re, unicodedata
from datetime import date
from collections import Counter
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(HERE, "..", "..", "old_data", "Asansör - Final.xlsx")
OUT  = os.path.join(HERE, "0005_seed_elevator.sql")
MODULE = "elevator"


def q(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return "null"
    return "'" + str(v).strip().replace("'", "''") + "'"


def num(v):
    return "0" if v in (None, "") else str(round(float(v), 2))


def norm(s):
    return unicodedata.normalize("NFKC", str(s)).strip().lower()


wb = openpyxl.load_workbook(XLSX, data_only=True)

# ---- Siteler -------------------------------------------------------------
sites, seen = [], Counter()
for r in wb["Siteler"].iter_rows(min_row=3, values_only=True):
    code, name, fee, day, note, status = (list(r) + [None] * 6)[:6]
    if not code or not name:
        continue
    seen[norm(name)] += 1
    if seen[norm(name)] > 1:                       # mükerrer isim -> koda göre ayrıştır
        name = "%s (%s)" % (name, code)
    sites.append(dict(
        code=str(code).strip(), name=str(name).strip(),
        fee=fee or 0, day=int(day) if day else None, note=note,
        status="active" if (status or "Aktif").strip().lower().startswith("aktif") else "passive",
    ))

# ---- Hareketler ----------------------------------------------------------
entries = []
for r in wb["_Veritabanı"].iter_rows(min_row=2, values_only=True):
    rid, sid, year, month, base, extra, paid, note = (list(r) + [None] * 8)[:8]
    if not sid or not year or not month:
        continue
    entries.append(dict(sid=str(sid).strip(), period="%04d-%02d-01" % (int(year), int(month)),
                        extra=extra, paid=paid, note=note, rid=rid))

# ---- ÖKSÜZ KAYIT KONTROLÜ (orphan records) -------------------------------
# Eski sistemde silinen bir sitenin hareketleri geride kalmış olabilir.
# Bu kayıtlar SESSİZCE ATILMAZ; pasif bir "kurtarma" sitesi altında korunur,
# böylece hiçbir tutar kaybolmaz. Kullanıcı sonradan doğru siteyle eşler.
known = {s["code"] for s in sites}
orphan_codes = sorted({e["sid"] for e in entries if e["sid"] not in known})
for oc in orphan_codes:
    sites.append(dict(code=oc, name="[KAYIP SITE] %s — eski sistemde tanimi yok" % oc,
                      fee=0, day=None,
                      note="Eski sistemde bu koda ait hareket vardi ama site tanimi yoktu. "
                           "Dogru siteyle eslestirip bu kaydi pasife alin.",
                      status="passive"))

CURRENT_PERIOD = date.today().replace(day=1).isoformat()

lines = []
w = lines.append
w("-- =====================================================================")
w("-- ELEVATOR360 | 0005_seed_elevator.sql  (otomatik üretildi)")
w("-- Kaynak: old_data/Asansör - Final.xlsx")
w("-- %d site, %d hareket kaydı" % (len(sites), len(entries)))
w("-- Tekrar çalıştırılabilir (idempotent): mükerrer kayıt oluşturmaz.")
w("-- =====================================================================")
w("begin;")
w("")
w("-- ---- Siteler ----")
w("insert into public.sites (module, code, name, monthly_fee, service_day, contract_status, notes) values")
vals = []
for s in sites:
    vals.append("  ('%s', %s, %s, %s, %s, '%s', %s)" % (
        MODULE, q(s["code"]), q(s["name"]), num(s["fee"]),
        s["day"] if s["day"] else "null", s["status"], q(s["note"])))
w(",\n".join(vals))
w("on conflict (module, code) do update set")
w("    name = excluded.name, monthly_fee = excluded.monthly_fee,")
w("    service_day = excluded.service_day, contract_status = excluded.contract_status;")
w("")

periods = sorted({e["period"] for e in entries})
first_period = min(periods) if periods else CURRENT_PERIOD

w("-- ---- Dönem (bilanço) satırları ----")
w("-- Geçmiş ve cari dönemler: aktif TÜM siteler için sabit ücret tahakkuku açılır.")
w("-- Gelecek dönemler: sadece eski veride hareketi olan siteler için açılır,")
w("-- aksi halde henüz doğmamış alacak bugünün raporlarını şişirirdi.")
past = [p for p in periods if p <= CURRENT_PERIOD]
future = [p for p in periods if p > CURRENT_PERIOD]

# Geçmiş/cari: ilk dönemden cari döneme kadar KESİNTİSİZ seri
w("insert into public.monthly_ledger (site_id, module, period, base_fee)")
w("select s.id, s.module, g.period::date, s.monthly_fee")
w("  from public.sites s")
w("  cross join generate_series(date '%s', date '%s', interval '1 month') as g(period)" % (first_period, CURRENT_PERIOD))
w("  where s.module = '%s' and s.contract_status = 'active'" % MODULE)
w("on conflict (site_id, period) do nothing;")
w("")
for p in future:
    codes = sorted({e["sid"] for e in entries if e["period"] == p})
    w("insert into public.monthly_ledger (site_id, module, period, base_fee)")
    w("select s.id, s.module, date '%s', s.monthly_fee from public.sites s" % p)
    w("  where s.module = '%s' and s.code in (%s)" % (MODULE, ", ".join(q(c) for c in codes)))
    w("on conflict (site_id, period) do nothing;")
w("")

# Öksüz kayıtların dönemleri: site pasif olduğu için yukarıdaki bloklara girmez,
# ayrıca açılır ki hiçbir tutar açıkta kalmasın.
if orphan_codes:
    w("-- ---- Kayip site kayitlarinin donemleri (tutarlar kaybolmasin diye) ----")
    for oc in orphan_codes:
        for p in sorted({e["period"] for e in entries if e["sid"] == oc}):
            w("insert into public.monthly_ledger (site_id, module, period, base_fee)")
            w("select s.id, s.module, date '%s', 0 from public.sites s" % p)
            w("  where s.module = '%s' and s.code = %s" % (MODULE, q(oc)))
            w("on conflict (site_id, period) do nothing;")
    w("")

w("-- ---- Hareketler (ekstra / tahsilat) ----")
for e in entries:
    lid = ("(select m.id from public.monthly_ledger m join public.sites s on s.id = m.site_id "
           "where s.module = '%s' and s.code = %s and m.period = date '%s')" % (MODULE, q(e["sid"]), e["period"]))
    for kind, amount, label in (("extra_charge", e["extra"], "Ekstra / parça (eski sistemden aktarıldı)"),
                                ("payment",      e["paid"],  "Tahsilat (eski sistemden aktarıldı)")):
        if amount in (None, 0):
            continue
        ref = "legacy:%s:%s" % (e["rid"], kind)
        w("insert into public.ledger_entries (ledger_id, entry_type, amount, description, entry_date, reference_no, client_request_id)")
        w("select %s, '%s', %s, %s, date '%s', %s, %s" % (
            lid, kind, num(amount), q(label), e["period"], q(ref), q(ref)))
        w("where %s is not null" % lid)
        w("on conflict (client_request_id) do nothing;")
    if e["note"]:
        w("update public.monthly_ledger set notes = %s where id = %s;" % (q(e["note"]), lid))
w("")
w("commit;")
w("")
tot_extra = sum(float(e["extra"] or 0) for e in entries)
tot_paid  = sum(float(e["paid"]  or 0) for e in entries)
w("-- ---- MUTABAKAT: asagidaki sorgu Excel'deki ham toplamlari dogrulamalidir ----")
w("-- Beklenen -> ekstra: %.2f   tahsilat: %.2f   site: %d" % (tot_extra, tot_paid, len(sites)))
w("-- select sum(extra_total) as ekstra, sum(paid_total) as tahsilat, count(distinct site_id) as site")
w("--   from public.monthly_ledger;")
w("-- select * from public.v_period_summary where module = 'elevator' order by period;")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

dups = [n for n, c in seen.items() if c > 1]
print("Yazildi:", OUT)
print("Site: %d | Hareket: %d | Donem: %d" % (len(sites), len(entries), len(periods)))
print("Mukerrer isim (koda gore ayristirildi):", dups if dups else "yok")
if orphan_codes:
    lost_e = sum(float(e["extra"] or 0) for e in entries if e["sid"] in orphan_codes)
    lost_p = sum(float(e["paid"]  or 0) for e in entries if e["sid"] in orphan_codes)
    print("UYARI - Site tanimi olmayan kodlar:", orphan_codes)
    print("   Bu kodlardaki tutarlar KAYBEDILMEDI, pasif 'KAYIP SITE' altinda korundu.")
    print("   Ekstra: %.2f  Tahsilat: %.2f" % (lost_e, lost_p))
print("Mutabakat hedefi -> ekstra: %.2f | tahsilat: %.2f" % (
      sum(float(e["extra"] or 0) for e in entries),
      sum(float(e["paid"]  or 0) for e in entries)))
print("Toplam aylik sabit ucret:", sum(float(s["fee"] or 0) for s in sites))
