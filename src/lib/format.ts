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

export const money = (v: string | number | null | undefined) => tl.format(num(v));
export const moneyShort = (v: string | number | null | undefined) => tlCompact.format(num(v));

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

/** '2026-09-15' -> '15.09.2026' */
export function dateLabel(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export const dayLabel = (n: number | null | undefined) =>
  n ? `Her ayın ${n}.` : '—';
