/** Sauvegarde / restauration manuelle et import du catalogue (CSV). */
import { db, uid, write, SYNC_TABLES, type Product } from '../db';
import { addMovements, rebuildStock } from './ops';
import { norm } from './format';

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of [...SYNC_TABLES, 'settings'] as const) data[t] = await (db as any)[t].toArray();
  return new Blob([JSON.stringify({ app: 'ayoka-quinca', version: 1, at: Date.now(), data })], { type: 'application/json' });
}

export async function importBackup(file: File) {
  const json = JSON.parse(await file.text());
  if (json.app !== 'ayoka-quinca') throw new Error("Ce fichier n'est pas une sauvegarde Ayoka Quinca.");
  const tables = [...SYNC_TABLES, 'settings'] as const;
  await db.transaction('rw', tables.map((t) => (db as any)[t]), async () => {
    for (const t of tables) {
      await (db as any)[t].clear();
      await (db as any)[t].bulkPut(json.data[t] ?? []);
    }
  });
  await rebuildStock();
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const CSV_HEADER = 'nom;categorie;reference;dimensions;unite;prix_achat;prix_vente;stock;emplacement;seuil_alerte';

export function csvTemplate(): Blob {
  return new Blob(
    ['﻿' + CSV_HEADER + '\nCiment CPJ 35;Ciment;CIM-001;50 kg;sac;4300;4700;120;Entrepôt ciment;30\nCoude PVC Ø32;Raccords;;;pièce;150;250;200;Étagère A;50\n'],
    { type: 'text/csv;charset=utf-8' },
  );
}

/** Import d'un fichier CSV (séparateur ; ou ,) exporté depuis Excel. Crée catégories manquantes et stock initial. */
export async function importProductsCsv(text: string, userId: string): Promise<{ created: number; errors: string[] }> {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => norm(h).replace(/ /g, '_'));
  const col = (row: string[], name: string) => (row[head.indexOf(name)] ?? '').trim();
  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;
  const errors: string[] = [];
  const locations = await db.locations.toArray();
  const categories = await db.categories.toArray();
  const products: Product[] = [];
  const stocks: { p: Product; q: number }[] = [];
  const newCats: typeof categories = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(sep);
    const name = col(row, 'nom');
    if (!name) continue;
    const locName = norm(col(row, 'emplacement'));
    const loc = locations.find((l) => norm(l.name) === locName || norm(l.code) === locName) ?? locations.find((l) => l.code === 'MAG');
    if (!loc) { errors.push(`Ligne ${i + 1} : emplacement introuvable`); continue; }
    const catName = col(row, 'categorie') || 'Divers articles';
    let cat = [...categories, ...newCats].find((c) => norm(c.name) === norm(catName));
    if (!cat) { cat = { id: uid(), name: catName, order: categories.length + newCats.length, updatedAt: 0 }; newCats.push(cat); }
    const p: Product = {
      id: uid(), name, categoryId: cat.id, ref: col(row, 'reference') || undefined, dimensions: col(row, 'dimensions') || undefined,
      unit: col(row, 'unite') || 'pièce', purchasePrice: num(col(row, 'prix_achat')), salePrice: num(col(row, 'prix_vente')),
      minStock: num(col(row, 'seuil_alerte')), locationId: loc.id, supplierIds: [], createdAt: Date.now(), updatedAt: 0,
    };
    if (!p.salePrice) errors.push(`Ligne ${i + 1} (${name}) : prix de vente manquant`);
    products.push(p);
    const q = num(col(row, 'stock'));
    if (q) stocks.push({ p, q });
  }
  await db.transaction('rw', [db.categories, db.products, db.movements, db.stock, db.outbox], async () => {
    if (newCats.length) await write('categories', newCats);
    await write('products', products);
    await addMovements(stocks.map(({ p, q }) => ({ productId: p.id, locationId: p.locationId, qty: q, type: 'initial' as const, userId, at: Date.now(), note: 'Import catalogue' })));
  });
  return { created: products.length, errors };
}

export { rebuildStock };
