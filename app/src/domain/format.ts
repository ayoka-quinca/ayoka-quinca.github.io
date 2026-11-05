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

/* --------- Montant en toutes lettres (« Arrêtée la présente facture à la somme de … ») --------- */
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const T: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

function below100(n: number, final: boolean): string {
  if (n < 17) return U[n];
  if (n < 20) return 'dix-' + U[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  if (t <= 6) return u === 0 ? T[t] : u === 1 ? `${T[t]} et un` : `${T[t]}-${U[u]}`;
  if (t === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + below100(10 + u, final);
  if (t === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : 'quatre-vingt-' + U[u];
  return 'quatre-vingt-' + below100(10 + u, final);
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return below100(r, final);
  const hs = h === 1 ? 'cent' : `${U[h]} cent`;
  if (!r) return h > 1 && final ? hs + 's' : hs;
  return `${hs} ${below100(r, final)}`;
}

/** 94400 → « quatre-vingt-quatorze mille quatre cents » (orthographe traditionnelle). */
export function enLettres(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const bn = Math.floor(n / 1e9); n %= 1e9;
  const mn = Math.floor(n / 1e6); n %= 1e6;
  const th = Math.floor(n / 1000); n %= 1000;
  if (bn) parts.push(`${below1000(bn, true)} milliard${bn > 1 ? 's' : ''}`);
  if (mn) parts.push(`${below1000(mn, true)} million${mn > 1 ? 's' : ''}`);
  if (th) parts.push(th === 1 ? 'mille' : `${below1000(th, false)} mille`);
  if (n) parts.push(below1000(n, true));
  return parts.join(' ');
}
