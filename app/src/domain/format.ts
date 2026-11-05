/** Formats adaptés au Bénin : franc CFA sans décimales, dates en français. */

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const qf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** 12500 → « 12 500 F » */
export function money(n: number, suffix = 'F'): string {
  return `${nf.format(Math.round(n)).replace(/ | /g, ' ')} ${suffix}`;
}

export function qty(n: number): string {
  return qf.format(n).replace(/ | /g, ' ');
}

export function dateShort(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function time(t: number): string {
  return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « Aujourd'hui 14:05 », « Hier 09:12 », « lun. 3 nov. » */
export function when(t: number): string {
  const d = new Date(t);
  const today = startOfDay(Date.now());
  if (t >= today) return `Aujourd'hui ${time(t)}`;
  if (t >= today - 86400000) return `Hier ${time(t)}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time(t);
}

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Recherche tolérante : sans accents, sans casse, tous les mots doivent être présents. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matches(haystack: string, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const h = norm(haystack);
  return q.split(' ').every((w) => h.includes(w));
}

/** Numéro de téléphone béninois → lien WhatsApp (indicatif 229). */
export function waLink(phone: string | undefined, text: string): string {
  let p = (phone ?? '').replace(/\D/g, '');
  if (p && !p.startsWith('229')) p = '229' + p;
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export const PAY_LABEL: Record<string, string> = {
  especes: 'Espèces',
  mtn: 'MTN MoMo',
  moov: 'Moov Money',
  credit: 'À crédit',
};
