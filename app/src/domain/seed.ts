/**
 * Données de départ.
 * - `seedStructure` : emplacements (d'après le plan du magasin) + catégories du cahier des charges.
 * - `seedDemo` : catalogue, clients, fournisseurs et historique FICTIFS pour essayer l'application.
 */
import { db, uid, setSetting, DEFAULT_COMPANY, type Location, type Category, type Product, type Movement, type Sale, type Client, type Supplier, type Payment, type Purchase, type User } from '../db';
import { hashPin } from './auth';
import { rebuildStock } from './ops';

// Plan : bâtiment de 20,2 m × 14,1 m (source : PLAN-AYOCA-QUINCA.pdf)
export const PLAN = { w: 20.2, h: 14.1 };

export const PLAN_ZONES: Omit<Location, 'id' | 'updatedAt'>[] = [
  { code: 'HALL', name: "Hall d'entrée", color: '#D9920F', rect: { x: 0, y: 9, w: 20.2, h: 5.1 }, sellable: true, order: 1, description: 'Exposition, petits articles, forte rotation' },
  { code: 'MAG', name: 'Magasin principal', color: '#2F6FB0', rect: { x: 3, y: 2.1, w: 17.2, h: 6.9 }, sellable: true, order: 2, description: 'Raccords, tuyaux, plomberie, serrurerie, électricité, outils' },
  { code: 'CIM', name: 'Entrepôt ciment', color: '#5B6472', rect: { x: 0, y: 6.5, w: 3, h: 2.5 }, sellable: true, order: 3, description: 'Sacs de ciment' },
  { code: 'CAR', name: 'Zone carrelage', color: '#7B4FB0', rect: { x: 0, y: 4.2, w: 3, h: 2.3 }, sellable: true, order: 4, description: 'Carreaux, colle, faïence' },
  { code: 'MAT', name: 'Entrepôt matériaux', color: '#8A5A2B', rect: { x: 0, y: 2.1, w: 3, h: 2.1 }, sellable: true, order: 5, description: 'Contreplaqués, isorels, matériaux de construction' },
  { code: 'COUR', name: 'Arrière-cour', color: '#C2410C', rect: { x: 0, y: 0, w: 20.2, h: 2.1 }, sellable: true, order: 6, description: 'Fers à béton, tôles, articles longs et encombrants' },
  { code: 'CAISSE', name: 'Espace caisse', color: '#0B6E4F', rect: { x: 13.2, y: 9, w: 7, h: 4 }, sellable: false, order: 7, description: 'Encaissement' },
];

const SHELVES: { parent: string; code: string; name: string; rect: Location['rect'] }[] = [
  { parent: 'MAG', code: 'MAG-A', name: 'Étagère A', rect: { x: 4.6, y: 3, w: 1, h: 5 } },
  { parent: 'MAG', code: 'MAG-B', name: 'Étagère B', rect: { x: 8.2, y: 3, w: 1, h: 5 } },
  { parent: 'MAG', code: 'MAG-C', name: 'Étagère C', rect: { x: 14.4, y: 3, w: 1, h: 5 } },
  { parent: 'MAG', code: 'MAG-D', name: 'Étagère D', rect: { x: 18, y: 3, w: 1, h: 5 } },
  { parent: 'HALL', code: 'HALL-P1', name: 'Présentoir 1', rect: { x: 1.5, y: 10.4, w: 4.5, h: 1 } },
  { parent: 'HALL', code: 'HALL-P2', name: 'Présentoir 2', rect: { x: 1.5, y: 12.4, w: 4.5, h: 1 } },
];

const CATEGORIES = [
  'Ciment', 'Fer à béton', 'Tôles', 'Contreplaqué', 'Isorel', 'Carrelage', 'Tuyaux', 'Raccords',
  'Tubes orange', 'Plomberie', 'Électricité', 'Serrurerie', 'Outils', 'Acides', 'Divers articles',
];

const USER_COLORS = ['#0B6E4F', '#B4540A', '#2F6FB0', '#7B4FB0', '#9F1239'];

export async function seedStructure(): Promise<{ loc: Record<string, string>; cat: Record<string, string> }> {
  const loc: Record<string, string> = {};
  const locations: Location[] = [];
  for (const z of PLAN_ZONES) {
    const id = uid();
    loc[z.code] = id;
    locations.push({ ...z, id, updatedAt: Date.now() });
  }
  SHELVES.forEach((s, i) => {
    const id = uid();
    loc[s.code] = id;
    const parent = PLAN_ZONES.find((z) => z.code === s.parent)!;
    locations.push({ id, code: s.code, name: s.name, parentId: loc[s.parent], color: parent.color, rect: s.rect, sellable: true, order: 10 + i, updatedAt: Date.now() });
  });
  const cat: Record<string, string> = {};
  const categories: Category[] = CATEGORIES.map((name, order) => {
    const id = uid();
    cat[name] = id;
    return { id, name, order, updatedAt: Date.now() };
  });
  await db.transaction('rw', db.locations, db.categories, db.outbox, async () => {
    await db.locations.bulkPut(locations);
    await db.categories.bulkPut(categories);
    await db.outbox.bulkAdd([
      ...locations.map((l) => ({ table: 'locations', id: l.id, at: Date.now() })),
      ...categories.map((c) => ({ table: 'categories', id: c.id, at: Date.now() })),
    ]);
  });
  await setSetting('company', DEFAULT_COMPANY);
  return { loc, cat };
}

export async function createOwner(name: string, pin: string): Promise<User> {
  const id = uid();
  const u: User = { id, name, role: 'responsable', pinHash: await hashPin(pin, id), active: true, color: USER_COLORS[0], updatedAt: Date.now() };
  await db.users.put(u);
  await db.outbox.add({ table: 'users', id, at: Date.now() });
  return u;
}

// --- Données fictives de démonstration ---------------------------------------

type P = [name: string, cat: string, unit: string, buy: number, sell: number, loc: string, min: number, stock: number, dims?: string, tiers?: [number, number][]];

const CATALOG: P[] = [
  ['Ciment CPJ 35', 'Ciment', 'sac', 4300, 4700, 'CIM', 40, 210, '50 kg', [[20, 4600], [100, 4550]]],
  ['Ciment CPJ 45', 'Ciment', 'sac', 4550, 4950, 'CIM', 20, 64, '50 kg', [[20, 4850]]],
  ['Fer à béton 6 mm', 'Fer à béton', 'barre', 1300, 1550, 'COUR', 50, 320, '12 m'],
  ['Fer à béton 8 mm', 'Fer à béton', 'barre', 2200, 2500, 'COUR', 50, 410, '12 m', [[50, 2450]]],
  ['Fer à béton 10 mm', 'Fer à béton', 'barre', 3500, 3900, 'COUR', 40, 260, '12 m', [[50, 3800]]],
  ['Fer à béton 12 mm', 'Fer à béton', 'barre', 5000, 5500, 'COUR', 30, 28, '12 m', [[50, 5400]]],
  ['Fer à béton 14 mm', 'Fer à béton', 'barre', 6800, 7400, 'COUR', 20, 46, '12 m'],
  ['Tôle bac alu 0,35', 'Tôles', 'mètre', 3200, 3800, 'COUR', 30, 140, 'larg. 1 m'],
  ['Tôle ondulée galvanisée', 'Tôles', 'feuille', 3000, 3500, 'COUR', 20, 0, '2 m'],
  ['Contreplaqué 5 mm', 'Contreplaqué', 'feuille', 7500, 8800, 'MAT', 10, 34, '122 × 244 cm'],
  ['Contreplaqué 10 mm', 'Contreplaqué', 'feuille', 11500, 13000, 'MAT', 8, 12, '122 × 244 cm'],
  ['Isorel 3 mm', 'Isorel', 'feuille', 3500, 4200, 'MAT', 10, 6, '122 × 244 cm'],
  ['Carreau sol grès 40×40', 'Carrelage', 'm²', 3800, 4500, 'CAR', 30, 180, '40 × 40 cm'],
  ['Carreau poli 60×60', 'Carrelage', 'm²', 6500, 7500, 'CAR', 20, 72, '60 × 60 cm'],
  ['Faïence murale 25×40', 'Carrelage', 'm²', 4200, 5000, 'CAR', 15, 9, '25 × 40 cm'],
  ['Colle carrelage', 'Carrelage', 'sac', 4000, 4800, 'CAR', 10, 25, '25 kg'],
  ['Croisillons 3 mm', 'Carrelage', 'sachet', 300, 500, 'HALL-P1', 20, 60, '200 pcs'],
  ['Tuyau PVC pression Ø20', 'Tuyaux', 'barre', 1200, 1500, 'MAG', 20, 85, '4 m'],
  ['Tuyau PVC pression Ø32', 'Tuyaux', 'barre', 2100, 2600, 'MAG', 20, 54, '4 m'],
  ['Tuyau PVC évacuation Ø50', 'Tuyaux', 'barre', 2800, 3400, 'MAG', 15, 31, '4 m'],
  ['Tuyau PVC évacuation Ø110', 'Tuyaux', 'barre', 6500, 7500, 'MAG', 10, 4, '4 m'],
  ['Coude PVC 90° Ø32', 'Raccords', 'pièce', 150, 250, 'MAG-A', 50, 340],
  ['Té PVC Ø32', 'Raccords', 'pièce', 200, 300, 'MAG-A', 40, 190],
  ['Manchon PVC Ø20', 'Raccords', 'pièce', 100, 150, 'MAG-A', 50, 22],
  ['Réduction PVC 50/32', 'Raccords', 'pièce', 300, 450, 'MAG-A', 20, 48],
  ['Tube orange Ø16', 'Tubes orange', 'barre', 250, 350, 'MAG', 50, 400, '3 m'],
  ['Tube orange Ø20', 'Tubes orange', 'barre', 300, 450, 'MAG', 50, 230, '3 m'],
  ['Robinet laiton 1/2"', 'Plomberie', 'pièce', 1800, 2500, 'MAG-A', 10, 26],
  ['Colle PVC', 'Plomberie', 'tube', 900, 1300, 'HALL-P1', 15, 40, '250 ml'],
  ['Fil électrique 2,5 mm²', 'Électricité', 'rouleau', 18000, 22000, 'MAG-B', 5, 14, '100 m'],
  ['Interrupteur simple', 'Électricité', 'pièce', 500, 800, 'MAG-B', 20, 75],
  ['Prise double', 'Électricité', 'pièce', 900, 1300, 'MAG-B', 20, 58],
  ['Ampoule LED 9 W', 'Électricité', 'pièce', 600, 1000, 'HALL-P2', 30, 120],
  ['Disjoncteur 16 A', 'Électricité', 'pièce', 2500, 3500, 'MAG-B', 10, 3],
  ['Cadenas 40 mm', 'Serrurerie', 'pièce', 1500, 2200, 'HALL-P2', 10, 33],
  ['Serrure 3 points', 'Serrurerie', 'pièce', 9000, 12000, 'MAG-C', 3, 7],
  ['Paumelle 100 mm', 'Serrurerie', 'pièce', 300, 500, 'MAG-C', 30, 150],
  ['Marteau de coffreur', 'Outils', 'pièce', 1500, 2500, 'MAG-D', 5, 18],
  ['Truelle', 'Outils', 'pièce', 1200, 2000, 'MAG-D', 5, 21],
  ['Mètre ruban 5 m', 'Outils', 'pièce', 1000, 1500, 'HALL-P1', 10, 30],
  ['Brouette', 'Outils', 'pièce', 22000, 27000, 'COUR', 2, 5],
  ['Acide chlorhydrique', 'Acides', 'bidon', 700, 1000, 'MAG-D', 10, 44, '1 L'],
  ['Pointes 70 mm', 'Divers articles', 'kg', 900, 1300, 'MAG-C', 20, 95],
  ["Fil d'attache recuit", 'Divers articles', 'kg', 900, 1200, 'MAG-C', 15, 60],
];

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export async function seedDemo() {
  const { loc, cat } = await seedStructure();
  const now = Date.now();
  const day = 86400000;
  const rand = rng(229);
  const ts = (d: number, h: number) => {
    const x = new Date(now - d * day);
    x.setHours(h, Math.floor(rand() * 60), 0, 0);
    return Math.min(x.getTime(), now - 60000);
  };

  const owner: User = { id: uid(), name: 'Sofiatou', role: 'responsable', pinHash: '', active: true, color: USER_COLORS[0], updatedAt: now };
  owner.pinHash = await hashPin('1234', owner.id);
  const cashier: User = { id: uid(), name: 'Caissière', role: 'caissiere', pinHash: '', active: true, color: USER_COLORS[1], updatedAt: now };
  cashier.pinHash = await hashPin('2222', cashier.id);
  const clerk: User = { id: uid(), name: 'Vendeur', role: 'employe', pinHash: '', active: true, color: USER_COLORS[2], updatedAt: now };
  clerk.pinHash = await hashPin('3333', clerk.id);

  const suppliers: Supplier[] = [
    { id: uid(), name: 'Ets Dossou Matériaux', phone: '0197000001', address: 'Cotonou, Dantokpa', createdAt: now, updatedAt: now },
    { id: uid(), name: 'Fer & Acier du Golfe', phone: '0196000002', address: 'Cotonou, zone portuaire', createdAt: now, updatedAt: now },
    { id: uid(), name: 'Agbo Distribution', phone: '0195000003', address: 'Porto-Novo', createdAt: now, updatedAt: now },
  ];
  const supFor = (c: string) => (['Ciment', 'Carrelage', 'Contreplaqué', 'Isorel'].includes(c) ? suppliers[0] : ['Fer à béton', 'Tôles'].includes(c) ? suppliers[1] : suppliers[2]);

  const products: Product[] = [];
  const moves: Movement[] = [];
  for (const [name, c, unit, buy, sell, l, min, stock, dims, tiers] of CATALOG) {
    const p: Product = {
      id: uid(), name, categoryId: cat[c], unit, purchasePrice: buy, salePrice: sell, minStock: min, locationId: loc[l],
      dimensions: dims, tiers: tiers?.map(([minQty, price]) => ({ minQty, price })), supplierIds: [supFor(c).id],
      ref: c.slice(0, 3).toUpperCase() + '-' + String(products.length + 1).padStart(3, '0'), createdAt: now - 40 * day, updatedAt: now,
    };
    products.push(p);
    // stock initial = stock cible + ce qui sera vendu dans l'historique (ajusté plus bas)
    moves.push({ id: uid(), productId: p.id, locationId: p.locationId, qty: stock, type: 'initial', userId: owner.id, at: now - 30 * day, updatedAt: now, note: 'Stock de départ' });
  }

  const clients: Client[] = [
    { id: uid(), name: 'M. Kossi (maçon)', phone: '0196112233', createdAt: now - 25 * day, updatedAt: now },
    { id: uid(), name: 'Entreprise BTP Houénou', phone: '0197445566', notes: 'Chantier Akpakpa', createdAt: now - 25 * day, updatedAt: now },
    { id: uid(), name: 'Mme Adjovi', phone: '0195778899', createdAt: now - 20 * day, updatedAt: now },
    { id: uid(), name: 'M. Tchibozo', phone: '0194001122', createdAt: now - 15 * day, updatedAt: now },
    { id: uid(), name: 'Plombier Sènan', phone: '0191223344', createdAt: now - 10 * day, updatedAt: now },
  ];

  const users = [owner, cashier, clerk];
  const sales: Sale[] = [];
  const payments: Payment[] = [];
  const sold = new Map<string, number>();
  const weights = products.map((p) => (/Ciment|Fer à béton/.test(p.name) ? 6 : /Tuyau|Coude|Té|Tube|Carreau/.test(p.name) ? 3 : 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = rand() * totalW;
    for (let i = 0; i < products.length; i++) if ((r -= weights[i]) < 0) return products[i];
    return products[0];
  };
  let seq = 0;
  for (let d = 20; d >= 0; d--) {
    const n = d === 0 ? 5 : 4 + Math.floor(rand() * 7);
    for (let k = 0; k < n; k++) {
      const at = ts(d, 8 + Math.floor(rand() * 10));
      const lines = 1 + Math.floor(rand() * 3);
      const items = [] as Sale['items'];
      for (let j = 0; j < lines; j++) {
        const p = pick();
        if (items.some((i) => i.productId === p.id)) continue;
        const bulky = /Ciment|Fer|Carreau|Tôle/.test(p.name);
        const q = bulky ? 2 + Math.floor(rand() * 20) : 1 + Math.floor(rand() * 6);
        const negotiated = rand() < 0.2 ? Math.round((p.salePrice * 0.96) / 50) * 50 : p.salePrice;
        items.push({ productId: p.id, name: p.name, unit: p.unit, qty: q, unitPrice: negotiated, listPrice: p.salePrice, cost: p.purchasePrice, locationId: p.locationId });
        sold.set(p.id, (sold.get(p.id) ?? 0) + q);
      }
      if (!items.length) continue;
      const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      const r = rand();
      const credit = r < 0.18;
      const client = credit || r < 0.35 ? clients[Math.floor(rand() * clients.length)] : undefined;
      const method = credit ? 'credit' : r < 0.6 ? 'especes' : r < 0.85 ? 'mtn' : 'moov';
      const paid = credit ? (rand() < 0.5 ? Math.round(total * 0.3 / 500) * 500 : 0) : total;
      const id = uid();
      seq++;
      sales.push({ id, number: `DEMO-${String(seq).padStart(4, '0')}`, clientId: client?.id, clientName: client?.name, items, total, paid, method, userId: users[Math.floor(rand() * 2)].id, at, updatedAt: now });
      for (const it of items) moves.push({ id: uid(), productId: it.productId, locationId: it.locationId, qty: -it.qty, type: 'vente', refId: id, userId: owner.id, at, updatedAt: now });
      if (credit && client && d > 4 && rand() < 0.5) {
        payments.push({ id: uid(), clientId: client.id, amount: Math.round((total - paid) * 0.5 / 500) * 500, method: 'especes', userId: cashier.id, at: at + 3 * day, updatedAt: now, note: 'Acompte' });
      }
    }
  }
  // Compense les ventes simulées pour retrouver le stock cible du catalogue.
  for (const m of moves) if (m.type === 'initial') m.qty += sold.get(m.productId) ?? 0;

  const purchases: Purchase[] = [];
  const pc = products.find((p) => p.name === 'Ciment CPJ 35')!;
  const pf = products.find((p) => p.name === 'Fer à béton 8 mm')!;
  for (const [d, sup, p, q] of [[12, suppliers[0], pc, 100], [6, suppliers[1], pf, 150], [2, suppliers[0], pc, 80]] as const) {
    const id = uid();
    const at = ts(d, 7);
    purchases.push({ id, supplierId: sup.id, invoiceNumber: `FAC-${2400 + d}`, items: [{ productId: p.id, name: p.name, qty: q, unitCost: p.purchasePrice, locationId: p.locationId }], total: q * p.purchasePrice, userId: owner.id, at, updatedAt: now });
    moves.push({ id: uid(), productId: p.id, locationId: p.locationId, qty: q, type: 'achat', refId: id, userId: owner.id, at, updatedAt: now });
    const init = moves.find((m) => m.type === 'initial' && m.productId === p.id)!;
    init.qty -= q;
  }

  await db.transaction('rw', [db.users, db.suppliers, db.products, db.movements, db.clients, db.sales, db.payments, db.purchases, db.settings], async () => {
    await db.users.bulkPut(users);
    await db.suppliers.bulkPut(suppliers);
    await db.products.bulkPut(products);
    await db.movements.bulkPut(moves);
    await db.clients.bulkPut(clients);
    await db.sales.bulkPut(sales);
    await db.payments.bulkPut(payments);
    await db.purchases.bulkPut(purchases);
    await db.settings.put({ key: 'demo', value: true });
  });
  await rebuildStock();
}

export async function wipeAll() {
  await db.delete();
  localStorage.removeItem('aq.session');
  location.reload();
}
