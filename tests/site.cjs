// Test du site vitrine. Usage : scripts/build-pages.sh / && (cd public-site && python3 -m http.server 4400) puis node tests/site.cjs
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:4400';
const OUT = process.argv[2] || require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT + '/shots', { recursive: true });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const check = (cond, msg) => { if (!cond) errs.push('ÉCHEC : ' + msg); else console.log('ok  ', msg); };
  for (const [label, opts] of [['m', devices['Pixel 7']], ['d', { viewport: { width: 1366, height: 860 } }]]) {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(label + ' pageerror: ' + e.message));
    p.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errs.push(label + ' console: ' + m.text()));
    // WhatsApp n'est pas ouvert pendant le test : on capture l'adresse que le site essaie d'ouvrir.
    await p.addInitScript(() => { window.open = (u) => { window.__wa = u; return {}; }; });
    await p.goto(BASE + '/'); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-01-hero.png` });
    check(await p.locator('.prod').count() > 0, `${label} catalogue affiché`);
    const ow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(ow <= 0, `${label} pas de défilement horizontal (${ow})`);
    await p.locator('#produits').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-02-produits.png` });
    await p.locator('#q').fill('fer 10'); await p.waitForTimeout(300);
    check((await p.locator('.prod h3').allInnerTexts()).some((t) => /10 mm/.test(t)), `${label} recherche « fer 10 »`);
    await p.locator('[data-add]').first().click();
    await p.locator('.stepper [data-inc]').first().click();
    await p.locator('#q').fill(''); await p.waitForTimeout(200);
    await p.locator('.chip', { hasText: 'Carrelage' }).click(); await p.waitForTimeout(200);
    await p.locator('[data-add]').first().click();
    check(await p.locator('[data-count]').first().innerText() === '2', `${label} compteur commande = 2`);
    await p.locator('[data-open-cart]').first().click(); await p.waitForTimeout(400);
    await p.locator('#cartForm button[type=submit]').click();
    check(await p.locator('#formError').isVisible(), `${label} message si nom manquant`);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-03-commande.png` });
    await p.locator('#f-name').fill('Koffi'); await p.locator('#f-place').fill('Ekpè');
    await p.locator('#cartForm button[type=submit]').click(); await p.waitForTimeout(800);
    const wa = await p.evaluate(() => window.__wa || '');
    const text = decodeURIComponent((wa.split('text=')[1] || ''));
    check(wa.startsWith('https://wa.me/2290196425281'), `${label} numéro WhatsApp de la boutique`);
    check(/2 barre · Fer à béton 10 mm/.test(text) && /Nom : Koffi/.test(text), `${label} message WhatsApp de commande`);
    await p.locator('.drawer-head [data-close-cart]').click();
    // Assistant
    await p.locator('#botFab').click(); await p.waitForTimeout(500);
    for (const q of ['Vous êtes ouverts le dimanche ?', '20 sacs de ciment', 'Je peux payer par MoMo ?', 'Vous avez des clous de charpente dorés ?']) {
      await p.locator('#botText').fill(q); await p.locator('#botForm').evaluate((f) => f.requestSubmit()); await p.waitForTimeout(700);
    }
    const log = await p.locator('#botLog').innerText();
    check(/Fermé/.test(log), `${label} assistant : horaires`);
    check(/Ajouter 20/.test(log), `${label} assistant : produit + quantité`);
    check(/MTN MoMo/.test(log), `${label} assistant : paiement`);
    check(/Envoyer ma question/.test(log), `${label} assistant : renvoi WhatsApp si inconnu`);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-04-assistant.png` });
    await p.locator('#botClose').click();
    await p.locator('#boutique').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-05-boutique.png` });
    await p.locator('#contact').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/shots/s-${label}-06-contact.png` });
    const r = await p.goto(BASE + '/gestion/'); await p.waitForTimeout(2600);
    check(r.ok() && /Fini les cahiers|Qui travaille/.test(await p.locator('body').innerText()), `${label} application de gestion sous /gestion/`);
    await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'TOUT EST BON');
  await b.close();
})();
