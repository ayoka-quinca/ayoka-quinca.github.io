/**
 * Opérations métier. Chaque opération est une transaction atomique :
 * soit tout est enregistré (vente + mouvements de stock + file d'envoi), soit rien.
 */
import {
  db, write, uid, getDeviceCode,
  type Movement, type MoveType, type Sale, type SaleItem, type Payment, type PayMethod,
  type Purchase, type PurchaseItem, type Inventory, type Product,
} from '../db';

const T_MOVE = [db.movements, db.stock, db.outbox] as const;

async function applyToCache(moves: Movement[]) {
  for (const m of moves) {
    const key: [string, string] = [m.productId, m.locationId];
    const row = await db.stock.get(key);
    await db.stock.put({ productId: m.productId, locationId: m.locationId, qty: (row?.qty ?? 0) + m.qty });
  }
}

export async function addMovements(moves: Omit<Movement, 'id' | 'updatedAt'>[]) {
  const full = moves.map((m) => ({ ...m, id: uid(), updatedAt: 0 })) as Movement[];
  await write('movements', full);
  await applyToCache(full);
  return full;
}

/** Reconstruit le cache du stock à partir de tous les mouvements (après synchronisation). */
export async function rebuildStock() {
  await db.transaction('rw', db.movements, db.stock, async () => {
    const map = new Map<string, number>();
    await db.movements.each((m) => {
      const k = m.productId + '|' + m.locationId;
      map.set(k, (map.get(k) ?? 0) + m.qty);
    });
    await db.stock.clear();
    await db.stock.bulkPut(
      [...map].map(([k, qty]) => {
        const [productId, locationId] = k.split('|');
        return { productId, locationId, qty };
      }),
    );
  });
}

export async function stockOf(productId: string): Promise<number> {
  const rows = await db.stock.where('productId').equals(productId).toArray();
  return rows.reduce((s, r) => s + r.qty, 0);
}

/** Prix applicable selon la quantité (prix dégressifs). */
export function priceFor(p: Product, q: number): number {
  let price = p.salePrice;
  for (const t of [...(p.tiers ?? [])].sort((a, b) => a.minQty - b.minQty)) if (q >= t.minQty) price = t.price;
  return price;
}

/** Répartit une sortie de stock : d'abord l'emplacement principal, puis les autres. */
async function allocate(p: Product, q: number): Promise<{ locationId: string; qty: number }[]> {
  const rows = (await db.stock.where('productId').equals(p.id).toArray()).filter((r) => r.qty > 0);
  rows.sort((a, b) => (a.locationId === p.locationId ? -1 : b.locationId === p.locationId ? 1 : b.qty - a.qty));
  const out: { locationId: string; qty: number }[] = [];
  let left = q;
  for (const r of rows) {
    if (left <= 0) break;
    const take = Math.min(r.qty, left);
    out.push({ locationId: r.locationId, qty: take });
    left -= take;
  }
  // Stock théorique insuffisant : on vend quand même (le magasin a raison), l'écart
  // apparaîtra en négatif et sera corrigé au prochain inventaire.
  if (left > 0) out.push({ locationId: p.locationId, qty: left });
  return out;
}

export interface CartLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

export async function createSale(opts: {
  lines: CartLine[];
  method: PayMethod;
  paid: number;
  clientId?: string;
  clientName?: string;
  userId: string;
}): Promise<Sale> {
  return db.transaction('rw', [db.sales, db.settings, ...T_MOVE], async () => {
    const seqRow = await db.settings.get('saleSeq');
    const seq = ((seqRow?.value as number) ?? 0) + 1;
    await db.settings.put({ key: 'saleSeq', value: seq });
    const id = uid();
    const items: SaleItem[] = [];
    const moves: Omit<Movement, 'id' | 'updatedAt'>[] = [];
    const now = Date.now();
    for (const l of opts.lines) {
      for (const a of await allocate(l.product, l.qty)) {
        items.push({
          productId: l.product.id, name: l.product.name, unit: l.product.unit, qty: a.qty,
          unitPrice: l.unitPrice, listPrice: priceFor(l.product, l.qty), cost: l.product.purchasePrice,
          locationId: a.locationId,
        });
        moves.push({ productId: l.product.id, locationId: a.locationId, qty: -a.qty, type: 'vente', refId: id, userId: opts.userId, at: now });
      }
    }
    const total = opts.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const sale: Sale = {
      id, number: `${getDeviceCode()}-${String(seq).padStart(4, '0')}`,
      clientId: opts.clientId, clientName: opts.clientName, items, total,
      paid: Math.min(opts.paid, total), method: opts.method, userId: opts.userId, at: now, updatedAt: 0,
    };
    await write('sales', sale);
    await addMovements(moves);
    return sale;
  });
}

/** Valeur nette d'une vente après retours. */
export function saleNet(s: Sale): number {
  return s.items.reduce((t, i) => t + (i.qty - (i.returnedQty ?? 0)) * i.unitPrice, 0);
}

export async function clientBalance(clientId: string): Promise<number> {
  const [sales, pays] = await Promise.all([
    db.sales.where('clientId').equals(clientId).toArray(),
    db.payments.where('clientId').equals(clientId).toArray(),
  ]);
  return (
    sales.filter((s) => !s.cancelled).reduce((t, s) => t + saleNet(s) - s.paid, 0) -
    pays.reduce((t, p) => t + p.amount, 0)
  );
}

/**
 * Retour de marchandises : remet en stock et réduit la dette du client.
 * Si la vente était payée, renvoie le montant à rembourser en espèces.
 */
export async function returnItems(sale: Sale, returns: Record<number, number>, userId: string): Promise<number> {
  return db.transaction('rw', [db.sales, db.payments, ...T_MOVE], async () => {
    const s = structuredClone(sale);
    let value = 0;
    const moves: Omit<Movement, 'id' | 'updatedAt'>[] = [];
    s.items.forEach((it, idx) => {
      const q = Math.min(returns[idx] ?? 0, it.qty - (it.returnedQty ?? 0));
      if (q > 0) {
        it.returnedQty = (it.returnedQty ?? 0) + q;
        value += q * it.unitPrice;
        moves.push({ productId: it.productId, locationId: it.locationId, qty: q, type: 'retour', refId: s.id, userId, at: Date.now() });
      }
    });
    if (!moves.length) return 0;
    const before = s.clientId ? await clientBalance(s.clientId) : 0;
    await write('sales', s);
    await addMovements(moves);
    // Ce qui dépasse la dette du client lui est rendu en espèces.
    const refund = Math.max(0, value - Math.max(0, before));
    if (refund > 0 && s.clientId) {
      await write<Payment>('payments', {
        id: uid(), clientId: s.clientId, amount: -refund, method: 'especes', saleId: s.id, userId, at: Date.now(),
        note: `Remboursement retour ${s.number}`, updatedAt: 0,
      });
    } else if (refund > 0) {
      s.paid -= refund;
      await write('sales', s);
    }
    return refund;
  });
}

export async function cancelSale(sale: Sale, userId: string) {
  await db.transaction('rw', [db.sales, ...T_MOVE], async () => {
    await write('sales', { ...sale, cancelled: true });
    await addMovements(
      sale.items
        .filter((i) => i.qty - (i.returnedQty ?? 0) > 0)
        .map((i) => ({ productId: i.productId, locationId: i.locationId, qty: i.qty - (i.returnedQty ?? 0), type: 'retour' as MoveType, refId: sale.id, userId, at: Date.now(), note: 'Annulation' })),
    );
  });
}

export async function recordPayment(p: Omit<Payment, 'id' | 'updatedAt' | 'at'>) {
  await db.transaction('rw', db.payments, db.outbox, () =>
    write<Payment>('payments', { ...p, id: uid(), at: Date.now(), updatedAt: 0 }),
  );
}

export async function createPurchase(opts: {
  supplierId: string; invoiceNumber?: string; items: PurchaseItem[]; userId: string; notes?: string; updateCost: boolean; at?: number;
}) {
  await db.transaction('rw', [db.purchases, db.products, ...T_MOVE], async () => {
    const id = uid();
    const at = opts.at ?? Date.now();
    const total = opts.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
    await write<Purchase>('purchases', { id, supplierId: opts.supplierId, invoiceNumber: opts.invoiceNumber, items: opts.items, total, userId: opts.userId, at, notes: opts.notes, updatedAt: 0 });
    await addMovements(opts.items.map((i) => ({ productId: i.productId, locationId: i.locationId, qty: i.qty, type: 'achat' as MoveType, refId: id, userId: opts.userId, at })));
    for (const i of opts.items) {
      const p = await db.products.get(i.productId);
      if (!p) continue;
      const next = { ...p, supplierIds: p.supplierIds.includes(opts.supplierId) ? p.supplierIds : [...p.supplierIds, opts.supplierId] };
      if (opts.updateCost) next.purchasePrice = i.unitCost;
      await write('products', next);
    }
  });
}

export async function transfer(p: Product, from: string, to: string, q: number, userId: string, makeMain: boolean) {
  await db.transaction('rw', [db.products, ...T_MOVE], async () => {
    const at = Date.now();
    const refId = uid();
    await addMovements([
      { productId: p.id, locationId: from, qty: -q, type: 'transfert', refId, userId, at },
      { productId: p.id, locationId: to, qty: q, type: 'transfert', refId, userId, at },
    ]);
    if (makeMain) await write('products', { ...p, locationId: to });
  });
}

export async function adjust(p: Product, locationId: string, delta: number, type: MoveType, userId: string, note: string) {
  await db.transaction('rw', [...T_MOVE], () => addMovements([{ productId: p.id, locationId, qty: delta, type, userId, at: Date.now(), note }]));
}

export async function startInventory(locationId: string, userId: string): Promise<Inventory> {
  return db.transaction('rw', [db.inventories, db.products, db.stock, db.outbox], async () => {
    const rows = await db.stock.where('locationId').equals(locationId).toArray();
    const products = await db.products.where('locationId').equals(locationId).toArray();
    const ids = new Set([...rows.filter((r) => r.qty !== 0).map((r) => r.productId), ...products.filter((p) => !p.archived).map((p) => p.id)]);
    const inv: Inventory = {
      id: uid(), locationId, status: 'en_cours', userId, startedAt: Date.now(), updatedAt: 0,
      lines: [...ids].map((productId) => ({ productId, expected: rows.find((r) => r.productId === productId)?.qty ?? 0 })),
    };
    await write('inventories', inv);
    return inv;
  });
}

export async function saveInventory(inv: Inventory) {
  await db.transaction('rw', db.inventories, db.outbox, () => write('inventories', inv));
}

export async function validateInventory(inv: Inventory, userId: string) {
  await db.transaction('rw', [db.inventories, ...T_MOVE], async () => {
    const at = Date.now();
    const moves = inv.lines
      .filter((l) => l.counted !== undefined && l.counted !== l.expected)
      .map((l) => ({ productId: l.productId, locationId: inv.locationId, qty: (l.counted as number) - l.expected, type: 'inventaire' as MoveType, refId: inv.id, userId, at, note: 'Écart d’inventaire' }));
    await addMovements(moves);
    await write('inventories', { ...inv, status: 'valide', validatedAt: at });
  });
}
