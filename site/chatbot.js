/**
 * Assistant AYOKA : petit assistant à règles, sans intelligence artificielle ni serveur.
 * - Il reconnaît les questions courantes par mots-clés (horaires, adresse, prix…).
 * - Il cherche dans le catalogue (« vous avez du fer de 10 ? », « 20 sacs de ciment »).
 * - Quand il ne sait pas, il propose d'envoyer la question à la boutique sur WhatsApp.
 * Les réponses viennent de data/config.json : modifier ce fichier suffit à les mettre à jour.
 */

const STOP = new Set('je j tu il vous on nous est c ce ca cela que qui quoi quel quelle quels quelles du de des la le les l un une au aux a en et ou pour par avec sur dans y avez avoir as ai est-ce estce svp sil plait merci bonjour bonsoir cherche cherchez veux voudrais voulais besoin faut il-y-a ya peut pouvez vendez vend vendu acheter prendre combien prix cout coute disponible dispo stock encore aussi me moi mon ma mes'.split(' '));

export function initBot(ctx) {
  const { cfg, cat, catOf, addToCart, openWa, orderText, units, openCart, matches, norm, icon } = ctx;
  const $ = (s) => document.querySelector(s);
  const fab = $('#botFab'), box = $('#bot'), log = $('#botLog'), quick = $('#botQuick'), form = $('#botForm'), input = $('#botText');
  let started = false;
  let lastQuestion = '';

  const waBtn = (text, label = 'Écrire à la boutique') => `<a class="wa-btn" href="https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('message-circle', 16)}${label}</a>`;
  const hours = () => cfg.horaires.map((h) => `${h.jours} : <strong>${h.heures}</strong>`).join('<br>');

  function say(html, delay = 450) {
    const typing = document.createElement('div');
    typing.className = 'msg bot-m';
    typing.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    log.appendChild(typing); log.scrollTop = log.scrollHeight;
    return new Promise((res) => setTimeout(() => {
      typing.innerHTML = html;
      typing.querySelectorAll('[data-bot-add]').forEach((b) => b.addEventListener('click', () => {
        addToCart(b.dataset.botAdd, Number(b.dataset.qty) || 1);
        b.textContent = 'Ajouté ✓'; b.disabled = true;
        chips(['Voir ma commande', 'Autre produit', 'Horaires']);
      }));
      typing.querySelectorAll('[data-bot-cart]').forEach((b) => b.addEventListener('click', () => { close(); openCart(); }));
      log.scrollTop = log.scrollHeight; res();
    }, delay));
  }
  function me(text) {
    const m = document.createElement('div');
    m.className = 'msg me'; m.textContent = text;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
  }
  function chips(list) {
    quick.innerHTML = list.map((c) => `<button class="chip" type="button">${c}</button>`).join('');
    quick.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  }

  /* ---------- Recherche produit ---------- */
  // Une quantité est un nombre suivi d'une unité (« 20 sacs ») ; un nombre seul est une taille (« fer de 10 »).
  const QTY = /(\d{1,4})\s*(sacs?|barres?|feuilles?|pieces?|rouleaux?|rouleau|kg|kilos?|metres?|m2|tubes?|bidons?|sachets?|cartons?|paquets?)\b/;
  function findProducts(text) {
    const words = norm(text).replace(QTY, ' ').split(' ').filter((w) => w && !STOP.has(w)).map((w) => (/^\d+$/.test(w) ? w : w.replace(/s$/, '')));
    if (!words.length) return [];
    const scored = cat.produits.map((p) => {
      const hay = norm(`${p.nom} ${p.dimension} ${catOf(p.categorie)?.nom} ${p.categorie}`);
      const hit = words.filter((w) => hay.includes(w)).length;
      return { p, hit };
    }).filter((x) => x.hit > 0);
    const best = Math.max(0, ...scored.map((x) => x.hit));
    return scored.filter((x) => x.hit === best).map((x) => x.p).slice(0, 6);
  }
  function qtyIn(text) {
    const m = norm(text).match(QTY);
    return m ? Number(m[1]) : 0;
  }
  function productReply(list, q, customHead) {
    const n = qtyIn(q);
    const items = list.map((p) => `<div class="mini-item"><span>${p.nom}${p.dimension ? ` <span style="color:var(--ink-3);font-weight:500">· ${p.dimension}</span>` : ''}</span>
      <button data-bot-add="${p.id}" data-qty="${n || 1}">${n ? `Ajouter ${n}` : 'Ajouter'}</button></div>`).join('');
    const head = customHead ?? (list.length === 1 ? `Oui, nous avons <strong>${list[0].nom}</strong>.` : `Voici ce que j'ai trouvé (${list.length}) :`);
    const price = cfg.afficherPrix && list.length === 1 && list[0].prix ? ` Prix indicatif : <strong>${new Intl.NumberFormat('fr-FR').format(list[0].prix)} F / ${list[0].unite}</strong>, dégressif selon la quantité.` : ' Le prix dépend de la quantité : la boutique vous le confirme sur WhatsApp.';
    return `${head}${price}<div class="mini">${items}</div>`;
  }

  /* ---------- Intentions ---------- */
  const INTENTS = [
    { k: /\b(bonjour|bonsoir|salut|hello|coucou|cc|yo)\b/, a: () => `Bonjour 👋 Que puis-je faire pour vous ? Une question sur un produit, les horaires, ou vous voulez préparer une commande ?`, c: ['Horaires', 'Adresse', 'Commander'], only: true },
    { k: /(horaire|heure|ouvert|ouvre|ferme|dimanche|samedi)/, a: () => `Nous sommes ouverts :<br>${hours()}`, c: ['Adresse', 'Commander'] },
    { k: /(adresse|ou (etes|se trouve|est)|situe|localis|itineraire|maps|venir|trouver la boutique|quartier)/, a: () => `Nous sommes à <strong>${cfg.adresse}</strong>.<br><a href="${cfg.googleMaps}" target="_blank" rel="noopener">Ouvrir l'itinéraire dans Google Maps →</a>`, c: ['Horaires', 'Téléphone'] },
    { k: /(telephone|numero|appel|joindre|contact|mail|email|tel\b)/, a: () => `Téléphone : <strong>${cfg.telephone}</strong><br>E-mail : ${cfg.email}<br>${waBtn(`Bonjour ${cfg.nom},`)}`, c: ['Horaires', 'Adresse'] },
    { k: /(credit|a terme|payer plus tard|avance)/, a: () => `Les facilités de paiement se discutent directement avec la responsable. Écrivez-lui :<br>${waBtn(`Bonjour ${cfg.nom}, je voudrais savoir si un paiement en plusieurs fois est possible.`)}`, c: ['Paiement', 'Commander'] },
    { k: /(pay|paiement|momo|mtn|moov|espece|cash|carte|mobile money)/, a: () => `Vous pouvez payer en <strong>${cfg.paiements.join(', ').replace(/, ([^,]*)$/, ' ou $1')}</strong>.`, c: ['Livraison', 'Commander'] },
    { k: /(livr|transport|camion|deposer|amener|chantier)/, a: () => `${cfg.livraison}<br>${waBtn(`Bonjour ${cfg.nom}, je voudrais une livraison à : `, 'Demander une livraison')}`, c: ['Commander', 'Adresse'] },
    { k: /(gros|grossiste|professionnel|entreprise|btp|quantite importante|proforma|devis|facture)/, a: () => `Oui : nous avons des <strong>prix de gros</strong> pour les chantiers et les professionnels, et nous faisons des <strong>factures proforma</strong>. Envoyez votre liste de matériaux :<br>${waBtn(`Bonjour ${cfg.nom}, je voudrais un devis (proforma) pour : `, 'Demander un devis')}`, c: ['Commander', 'Paiement'] },
    { k: /(prix|combien|cout|tarif|cher)/, a: () => cfg.afficherPrix ? `Les prix du catalogue sont indicatifs et baissent avec la quantité. Dites-moi le produit (ex : « prix du ciment ») ou envoyez votre liste à la boutique.` : `Nos prix changent selon la quantité et les arrivages : la boutique vous donne le prix exact sur WhatsApp, en général rapidement. Ajoutez vos produits à la commande, ou dites-moi ce que vous cherchez (ex : « fer de 10 »).`, c: ['Ciment', 'Fer à béton', 'Commander'] },
    { k: /(voir ma commande|ma commande|mon panier|panier)/, a: () => units() ? `Votre commande contient <strong>${units()} produit(s)</strong>.<br><button class="wa-btn" style="border:0;cursor:pointer;background:var(--ink)" data-bot-cart>${icon('shopping-bag', 16)}Vérifier et envoyer</button>` : `Votre commande est vide pour l'instant. Dites-moi ce qu'il vous faut (ex : « 20 sacs de ciment »).`, c: ['Ciment', 'Fer à béton', 'Plomberie'] },
    { k: /(commander|commande|acheter|reserver|comment ca marche|comment faire)/, a: () => `C'est simple : <strong>1.</strong> ajoutez les produits (ici ou dans le catalogue), <strong>2.</strong> envoyez la liste sur WhatsApp, <strong>3.</strong> passez récupérer, tout est prêt.${units() ? `<br><button class="wa-btn" style="border:0;cursor:pointer;background:var(--ink)" data-bot-cart>${icon('shopping-bag', 16)}Voir ma commande (${units()})</button>` : ' Que vous faut-il ?'}`, c: ['Ciment', 'Fer à béton', 'Carrelage'] },
    { k: /(parler|humain|quelqu|personne|conseiller|responsable|vendeur|whatsapp)/, a: () => `Bien sûr. La boutique vous répond sur WhatsApp :<br>${waBtn(`Bonjour ${cfg.nom}, ${lastQuestion && !/parler|humain|whatsapp/i.test(lastQuestion) ? lastQuestion : "j'ai une question : "}`)}`, c: ['Horaires', 'Adresse'] },
    { k: /(merci|super|parfait|ok|d'accord|daccord|top)/, a: () => `Avec plaisir ! Autre chose ?`, c: ['Commander', 'Horaires'], only: true },
    { k: /^(autre produit)$/, a: () => `Dites-moi le produit et la quantité, par exemple « 50 barres de fer 8 » ou « colle carrelage ».`, c: ['Ciment', 'Tôles', 'Électricité'] },
  ];

  async function ask(text) {
    const q = text.trim();
    if (!q) return;
    me(q);
    const n = norm(q);
    // 1. Produit ou catégorie nommés ? (« ciment », « tuyau 32 », « 20 sacs de ciment »)
    const intent = INTENTS.find((i) => i.k.test(n) && (!i.only || n.split(' ').length <= 3));
    const prods = findProducts(q);
    const catHit = cat.categories.find((c) => norm(c.nom) === n || norm(c.nom).startsWith(n) && n.length > 3);
    if (catHit && !intent) {
      const list = cat.produits.filter((p) => p.categorie === catHit.id);
      await say(productReply(list.slice(0, 6), q, `<strong>${catHit.nom}</strong> : ${catHit.description}`));
      chips(['Voir ma commande', 'Prix', 'Autre produit']);
      lastQuestion = q; return;
    }
    if (prods.length && (!intent || /(prix|combien|avez|cherche|besoin|\d)/.test(n))) {
      await say(productReply(prods, q));
      chips(['Voir ma commande', 'Prix', 'Autre produit']);
      lastQuestion = q; return;
    }
    // 2. Question courante
    if (intent) {
      await say(intent.a());
      chips(intent.c);
      lastQuestion = q; return;
    }
    // 3. Je ne sais pas → WhatsApp avec la question déjà écrite
    lastQuestion = q;
    await say(`Je n'ai pas la réponse à cette question, mais la boutique, oui. Je prépare le message pour vous :<br>${waBtn(`Bonjour ${cfg.nom}, j'ai une question : ${q}`, 'Envoyer ma question')}`);
    chips(['Horaires', 'Adresse', 'Commander']);
  }

  function open() {
    box.hidden = false; fab.hidden = true; fab.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      say(`Bonjour 👋 Je suis l'assistant d'<strong>${cfg.nom}</strong>. Je réponds tout de suite sur les <strong>horaires</strong>, l'<strong>adresse</strong>, les <strong>produits</strong> et les <strong>commandes</strong>. Pour un prix précis, je vous mets en contact avec la boutique sur WhatsApp.`, 300);
      chips(['Horaires', 'Adresse', 'Commander', 'Prix', 'Paiement', 'Livraison', 'Parler à la boutique']);
    }
    setTimeout(() => input.focus(), 320);
  }
  function close() { box.hidden = true; fab.hidden = false; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }

  fab.addEventListener('click', open);
  $('#botClose').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; ask(t); });
  // Outil utilisé par l'assistant (et disponible pour d'autres boutons) : envoyer la commande en cours.
  window.ayokaSendOrder = () => openWa(orderText());
}
