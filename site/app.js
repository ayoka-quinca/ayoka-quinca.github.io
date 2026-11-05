/**
 * Site vitrine AYOKA QUINCA.
 * Aucun outil de construction : ce fichier est servi tel quel par GitHub Pages.
 * Données : data/config.json (boutique) et data/catalogue.json (produits).
 * La commande est gardée dans le navigateur du visiteur puis envoyée sur WhatsApp.
 */
import { icon } from './icons.js';
import { initBot } from './chatbot.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Outils ---------- */
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const matches = (hay, q) => { const n = norm(q); return !n || n.split(' ').every((w) => norm(hay).includes(w)); };
const money = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ')} F`;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible : la commande reste en mémoire */ } },
};

let cfg = {};
let cat = { categories: [], produits: [] };
let cart = store.get('ayoka.cart', {});
const state = { cat: 'populaires', q: '', limit: 12 };

export function waLink(text) {
  return `https://wa.me/${cfg.whatsapp ?? ''}?text=${encodeURIComponent(text)}`;
}
export function openWa(text) {
  const w = window.open(waLink(text), '_blank', 'noopener');
  if (!w) location.href = waLink(text);
}
export function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}

function paintIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => { el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20); });
}

/* ---------- Données ---------- */
async function load() {
  const [c, k] = await Promise.all([fetch('data/config.json').then((r) => r.json()), fetch('data/catalogue.json').then((r) => r.json())]);
  cfg = c; cat = k;
}

function fillConfig() {
  $$('[data-cfg]').forEach((el) => { const v = cfg[el.dataset.cfg]; if (v !== undefined) el.textContent = v; });
  $$('[data-cfg-href]').forEach((el) => { el.href = cfg[el.dataset.cfgHref]; });
  $$('[data-wa]').forEach((el) => { el.href = waLink(el.dataset.wa + ' '); });
  $$('[data-tel]').forEach((el) => { el.href = `tel:+229${cfg.telephone.replace(/\D/g, '')}`; });
  $('#hours').innerHTML = cfg.horaires.map((h) => `<dt>${h.jours}</dt><dd>${h.heures}</dd>`).join('');
  $('#year').textContent = new Date().getFullYear();
  if (cfg.afficherPrix) $('[data-price-note]').textContent = 'Prix indicatifs au détail. Tarifs dégressifs selon la quantité : demandez votre devis sur WhatsApp.';
}

const catOf = (id) => cat.categories.find((c) => c.id === id);
const tint = (c, p) => `color-mix(in srgb, ${c} ${p}%, #ffffff)`;

/* ---------- Mosaïque de l'accroche ---------- */
function mosaic() {
  const picks = ['ciment', 'fer', 'carrelage', 'plomberie', 'electricite', 'outils'];
  $('#mosaic').innerHTML = picks.map((id, i) => {
    const c = catOf(id);
    const dark = i === 4;
    return `<a class="tile ${dark ? 'dark' : ''}" href="#produits" data-goto="${id}" style="animation-delay:${i * 0.06}s">
      <span class="t-ic" style="background:${dark ? 'rgba(255,255,255,.12)' : tint(c.couleur, 14)};color:${dark ? '#fff' : c.couleur}">${icon(c.icone, 24)}</span>
      <strong>${c.nom}</strong></a>`;
  }).join('');
  $$('[data-goto]').forEach((a) => a.addEventListener('click', () => { state.cat = a.dataset.goto; state.q = ''; $('#q').value = ''; renderChips(); renderGrid(); }));
}

/* ---------- Catalogue ---------- */
function renderChips() {
  const all = [{ id: 'populaires', nom: '★ Les plus demandés' }, { id: 'tous', nom: 'Tout voir' }, ...cat.categories];
  $('#chips').innerHTML = all.map((c) => `<button class="chip ${state.cat === c.id ? 'on' : ''}" role="tab" aria-selected="${state.cat === c.id}" data-cat="${c.id}">${c.icone ? icon(c.icone, 16) : ''}${c.nom}</button>`).join('');
  $$('#chips .chip').forEach((b) => b.addEventListener('click', () => { state.cat = b.dataset.cat; state.limit = 12; renderChips(); renderGrid(); }));
}

function stepper(p, qty) {
  return `<div class="stepper" data-id="${p.id}">
    <button type="button" data-dec aria-label="Moins">${icon('minus', 16)}</button>
    <span style="display:flex;align-items:baseline"><input inputmode="numeric" value="${qty}" aria-label="Quantité de ${p.nom}"><span class="unit">${p.unite}</span></span>
    <button type="button" data-inc aria-label="Plus">${icon('plus', 16)}</button></div>`;
}

function visible() {
  let list = cat.produits;
  if (state.q) list = list.filter((p) => matches(`${p.nom} ${p.dimension} ${catOf(p.categorie)?.nom}`, state.q));
  else if (state.cat === 'populaires') list = list.filter((p) => p.populaire);
  else if (state.cat !== 'tous') list = list.filter((p) => p.categorie === state.cat);
  return list;
}

function card(p) {
  const c = catOf(p.categorie);
  const qty = cart[p.id] ?? 0;
  return `<article class="card prod">
    <div class="prod-top">
      <span class="p-ic" style="background:${tint(c.couleur, 14)};color:${c.couleur}">${icon(c.icone, 22)}</span>
      ${p.populaire ? '<span class="badge">Très demandé</span>' : ''}
    </div>
    <h3>${p.nom}</h3>
    <p class="meta">${[p.dimension, `vendu au ${p.unite === 'm²' ? 'm²' : p.unite}`].filter(Boolean).join(' · ')}</p>
    ${cfg.afficherPrix && p.prix ? `<p class="price">${money(p.prix)} <small>/ ${p.unite} · indicatif</small></p>` : '<p class="price"><small>Prix sur demande</small></p>'}
    <div class="add">${qty ? stepper(p, qty) : `<button class="btn btn-soft btn-block" data-add="${p.id}">${icon('plus', 18)}Ajouter</button>`}</div>
  </article>`;
}

function renderGrid() {
  const list = visible();
  const shown = list.slice(0, state.q ? 60 : state.limit);
  $('#grid').innerHTML = shown.map(card).join('') + (list.length > shown.length ? `<div class="more" style="grid-column:1/-1"><button class="btn btn-line" id="more">Voir ${list.length - shown.length} produit(s) de plus</button></div>` : '');
  $('#empty').hidden = list.length > 0;
  $('#more')?.addEventListener('click', () => { state.limit += 24; renderGrid(); });
  bindQty($('#grid'));
}

/* ---------- Commande ---------- */
const findP = (id) => cat.produits.find((p) => p.id === id);
const units = () => Object.values(cart).reduce((a, b) => a + b, 0);

export function setQty(id, q, silent) {
  const p = findP(id);
  if (!p) return;
  const before = cart[id] ?? 0;
  if (q > 0) cart[id] = Math.min(9999, Math.round(q)); else delete cart[id];
  store.set('ayoka.cart', cart);
  if (!before && q > 0 && !silent) toast(`${p.nom} ajouté à votre commande`);
  refresh();
}
export function addToCart(id, q = 1) { setQty(id, (cart[id] ?? 0) + q); }

function bindQty(root) {
  $$('[data-add]', root).forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.add)));
  $$('.stepper', root).forEach((s) => {
    const id = s.dataset.id;
    $('[data-dec]', s).addEventListener('click', () => setQty(id, (cart[id] ?? 0) - 1));
    $('[data-inc]', s).addEventListener('click', () => setQty(id, (cart[id] ?? 0) + 1));
    const inp = $('input', s);
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('change', () => { const n = parseInt(inp.value.replace(/\D/g, ''), 10); setQty(id, Number.isFinite(n) ? n : 0); });
  });
}

function refresh() {
  const n = Object.keys(cart).length;
  $$('[data-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  $$('[data-count-text]').forEach((el) => { el.textContent = `${n} produit${n > 1 ? 's' : ''} dans ma commande`; });
  $('#orderbar').hidden = !n;
  document.body.classList.toggle('has-order', n > 0);
  renderGrid();
  renderCart();
}

function renderCart() {
  const ids = Object.keys(cart).filter(findP);
  $('#cartList').innerHTML = ids.length ? ids.map((id) => {
    const p = findP(id), c = catOf(p.categorie);
    return `<div class="line"><span class="p-ic" style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:${tint(c.couleur, 14)};color:${c.couleur}">${icon(c.icone, 18)}</span>
      <div class="grow"><strong>${p.nom}</strong><small>${p.dimension || c.nom}</small></div>${stepper(p, cart[id])}</div>`;
  }).join('') : `<div class="cart-empty">${icon('shopping-bag', 34)}<strong>Votre commande est vide</strong><span class="small">Ajoutez des produits depuis le catalogue, ou demandez à l'assistant.</span><a href="#produits" class="btn btn-soft" data-close-cart>Voir les produits</a></div>`;
  bindQty($('#cartList'));
  $$('#cartList [data-close-cart]').forEach((b) => b.addEventListener('click', closeCart));
  $('#cartForm').hidden = !ids.length;
}

function openCart() { $('#cart').hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#cart .drawer-head .icon-btn').focus(), 50); }
function closeCart() { $('#cart').hidden = true; document.body.style.overflow = ''; }

/** Message WhatsApp de commande : lisible par la boutique, sans rien à retaper. */
export function orderText(form = {}) {
  const lines = Object.keys(cart).filter(findP).map((id) => { const p = findP(id); return `• ${cart[id]} ${p.unite} · ${p.nom}${p.dimension ? ` (${p.dimension})` : ''}`; });
  return [
    `Bonjour ${cfg.nom} 👋`, 'Je souhaite commander :', ...lines, '',
    form.name && `Nom : ${form.name}`, form.place && `Quartier / chantier : ${form.place}`, form.mode, form.note && `Précision : ${form.note}`,
    '', 'Merci de me confirmer la disponibilité et le prix.',
  ].filter((l) => l !== undefined && l !== false && l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}

function bindCart() {
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
  $$('[data-close-cart]').forEach((b) => b.addEventListener('click', closeCart));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#cart').hidden) closeCart(); });
  const saved = store.get('ayoka.client', {});
  if (saved.name) $('#f-name').value = saved.name;
  if (saved.place) $('#f-place').value = saved.place;
  $('#cartForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#formError');
    const form = { name: $('#f-name').value.trim(), place: $('#f-place').value.trim(), note: $('#f-note').value.trim(), mode: $('#cartForm').mode.value };
    const problems = [!Object.keys(cart).length && 'Ajoutez au moins un produit.', !form.name && 'Indiquez votre nom, pour que la boutique sache qui lui écrit.'].filter(Boolean);
    if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; $('#f-name').focus(); return; }
    err.hidden = true;
    store.set('ayoka.client', { name: form.name, place: form.place });
    openWa(orderText(form));
    toast('WhatsApp s’ouvre avec votre commande. Appuyez sur Envoyer.');
  });
}

/* ---------- Plan du magasin (illustration) ---------- */
function plan() {
  const Z = [
    ['Arrière-cour · fers et tôles', 0, 0, 20.2, 2.1, '#C2410C'], ['Matériaux', 0, 2.1, 3, 2.1, '#8A5A2B'], ['Carrelage', 0, 4.2, 3, 2.3, '#7B4FB0'],
    ['Ciment', 0, 6.5, 3, 2.5, '#5B6472'], ['Magasin principal', 3, 2.1, 17.2, 6.9, '#2F6FB0'], ["Hall d'entrée", 0, 9, 13.2, 5.1, '#D9920F'], ['Caisse', 13.2, 9, 7, 5.1, '#12804C'],
  ];
  const r = Z.map(([n, x, y, w, h, c]) => `<g><rect x="${x + 0.08}" y="${y + 0.08}" width="${w - 0.16}" height="${h - 0.16}" rx="0.3" fill="${tint(c, 14)}" stroke="${c}" stroke-width="0.06"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 0.18}" text-anchor="middle" font-size="${w < 4 ? 0.44 : 0.62}" font-weight="750" fill="#141414">${n}</text></g>`).join('');
  $('#plan').innerHTML = `<svg viewBox="-0.4 -0.4 21 15.6" role="img" aria-label="Plan du magasin AYOKA QUINCA"><rect x="-0.12" y="-0.12" width="20.44" height="14.34" rx="0.5" fill="#fff" stroke="#141414" stroke-width="0.12"/>${r}
    <line x1="8" y1="14.1" x2="11.4" y2="14.1" stroke="#fff" stroke-width="0.3"/><text x="9.7" y="14.95" text-anchor="middle" font-size="0.42" font-weight="750" fill="#B8410A">▲ Entrée</text></svg>`;
}

/* ---------- Démarrage ---------- */
async function start() {
  // Retire l'ancien service worker de l'application, installé à la racine avant la V2.2,
  // qui pouvait encore afficher l'ancienne page d'accueil (l'application reste dans /gestion/).
  navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => {
    if (!new URL(r.scope).pathname.startsWith(new URL('gestion/', location.href).pathname)) r.unregister();
  })).catch(() => {});
  paintIcons();
  $('#menuBtn').addEventListener('click', () => { const n = $('#nav'); const open = n.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', open); });
  $$('#nav a').forEach((a) => a.addEventListener('click', () => { $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); }));
  try {
    await load();
  } catch {
    $('#grid').innerHTML = '<p class="empty" style="grid-column:1/-1">Le catalogue n’a pas pu se charger. Vérifiez votre connexion et rechargez la page, ou appelez-nous au 01 96 42 52 81.</p>';
    return;
  }
  fillConfig();
  paintIcons();
  mosaic(); plan(); renderChips(); bindCart(); refresh();
  let t;
  $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; renderGrid(); }, 120); });
  initBot({ cfg, cat, catOf, addToCart, openWa, orderText, units: () => Object.keys(cart).length, openCart, matches, norm, icon });
}
start();
