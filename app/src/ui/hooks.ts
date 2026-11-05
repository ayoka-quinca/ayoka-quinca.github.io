import { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, type Location, type Product, type User, type Client, type Supplier } from '../db';

export interface Session {
  user: User;
  lock: () => void;
}
export const SessionCtx = createContext<Session | null>(null);
export function useSession(): Session {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('Pas de session');
  return s;
}

const EMPTY: never[] = [];

export function useProducts(): Product[] {
  return useLiveQuery(() => db.products.filter((p) => !p.archived).sortBy('name'), []) ?? EMPTY;
}
export function useLocations(): { list: Location[]; map: Map<string, Location> } {
  const list = useLiveQuery(() => db.locations.orderBy('order').toArray(), []) ?? EMPTY;
  return { list, map: new Map(list.map((l) => [l.id, l])) };
}
export function useCategories(): { list: Category[]; map: Map<string, Category> } {
  const list = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? EMPTY;
  return { list, map: new Map(list.map((c) => [c.id, c])) };
}
/** Stock total par produit (somme de tous les emplacements). */
export function useStockMap(): Map<string, number> {
  const rows = useLiveQuery(() => db.stock.toArray(), []) ?? EMPTY;
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.productId, (m.get(r.productId) ?? 0) + r.qty);
  return m;
}
export function useClients(): Client[] {
  return useLiveQuery(() => db.clients.orderBy('name').toArray(), []) ?? EMPTY;
}
export function useSuppliers(): Supplier[] {
  return useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []) ?? EMPTY;
}
export function useUsers(): Map<string, User> {
  const list = useLiveQuery(() => db.users.toArray(), []) ?? EMPTY;
  return new Map(list.map((u) => [u.id, u]));
}

/** Soldes de tous les clients (ce qu'ils doivent encore). */
export function useBalances(): Map<string, number> {
  const data = useLiveQuery(async () => {
    const [sales, pays] = await Promise.all([db.sales.where('clientId').above('').toArray(), db.payments.toArray()]);
    return { sales, pays };
  }, []);
  const m = new Map<string, number>();
  if (!data) return m;
  for (const s of data.sales) {
    if (s.cancelled || !s.clientId) continue;
    const net = s.items.reduce((t, i) => t + (i.qty - (i.returnedQty ?? 0)) * i.unitPrice, 0);
    m.set(s.clientId, (m.get(s.clientId) ?? 0) + net - s.paid);
  }
  for (const p of data.pays) m.set(p.clientId, (m.get(p.clientId) ?? 0) - p.amount);
  return m;
}

/** Zone racine d'un emplacement (une étagère → sa zone). */
export function rootOf(loc: Location | undefined, map: Map<string, Location>): Location | undefined {
  let l = loc;
  while (l?.parentId) l = map.get(l.parentId);
  return l;
}
