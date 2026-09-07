/** Turkce para / tarih / donem bicimlendirme yardimcilari */

const tl = new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const tlCompact = new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/** Supabase numeric alanlari string dondurur; guvenli cevirim */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Kullanicinin virgul/nokta ile girdigi tutari sayiya cevirir; bos deger 0 kabul edilir */
export function parseAmount(text: string): number {
  if (!text.trim()) return 0;
  const normalized = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export const money = (v: string | number | null | undefined) => tl.format(num(v));
export const moneyShort = (v: string | number | null | undefined) => tlCompact.format(num(v));

/**
 * Karsilama ekranindaki "Merhaba, ..." icin sunuma hazir isim. profiles.full_name
 * bazen "Ad Soyad" yerine ham bir kullanici adi ("ahmetgur190758") tasiyabilir —
 * boyle gorununce amator durmasin diye sondaki rakamlar atilip kalan metin
 * buyuk harfle baslatilir (bkz. kullanici geri bildirimi).
 */
export function formatGreetingName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return '';
  if (/\s/.test(trimmed)) return trimmed; // "Ad Soyad" gibi gorunuyor — oldugu gibi kullan

  const stripped = trimmed.replace(/\d+$/, '');
  if (!stripped) return '';
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Gunun saatine gore Ana Ekran karsilama basligi ("İyi Günler" vb.) */
export function timeGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 23 || h < 6) return 'İyi Geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi Günler';
  return 'İyi Akşamlar';
}

const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
               'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const AYLAR_ASCII = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran',
                     'Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik'];

/** '2026-09-01' -> 'Eylül 2026' */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${AYLAR[m - 1]} ${y}`;
}

/** Dosya adi icin sade/ASCII donem etiketi: '2026-09-01' -> 'Eylul_2026' */
export function periodFileLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${AYLAR_ASCII[m - 1]}_${y}`;
}

/** '2026-06-01' -> '06.2026' — CSV disa aktarimda kisa/nümerik donem etiketi */
export function periodShortLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${m}.${y}`;
}

/** Date -> '2026-09-01' (ayin ilk gunu) */
export function toPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function currentPeriod(): string {
  return toPeriod(new Date());
}

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  return toPeriod(new Date(y, m - 1 + months, 1));
}

/** Donem henuz acilmamis (bugunku aydan sonraki) bir gelecek ay mi? */
export function isFuturePeriod(period: string): boolean {
  return period > currentPeriod();
}

/** '2026-09-15' -> '15.09.2026' */
export function dateLabel(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export const dayLabel = (n: number | null | undefined) =>
  n ? `Her ayın ${n}.` : '—';
