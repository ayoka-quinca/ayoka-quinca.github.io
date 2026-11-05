/**
 * Base de données locale (IndexedDB via Dexie).
 *
 * Principe clé : le stock n'est JAMAIS stocké comme un chiffre modifiable.
 * Il est la somme des mouvements (achats, ventes, retours, ajustements, transferts).
 * Les mouvements sont immuables : deux téléphones hors ligne peuvent vendre en même
 * temps, la synchronisation additionne simplement leurs mouvements, sans conflit.
 *
 * Chaque écriture passe par `write()` qui horodate l'enregistrement et l'ajoute
 * à la file d'envoi (`outbox`) pour la synchronisation avec le serveur.
 */
import Dexie, { type Table } from 'dexie';

export type Role = 'responsable' | 'caissiere' | 'employe';
export type PayMethod = 'especes' | 'mtn' | 'moov' | 'credit';
export type MoveType =
  | 'achat'
  | 'vente'
  | 'retour'
  | 'inventaire'
  | 'transfert'
  | 'perte'
  | 'initial';

interface Base {
  id: string;
  updatedAt: number;
  deviceId?: string;
}

export interface Location extends Base {
  code: string;
  name: string;
  parentId?: string; // étagère / rangée → zone parente
  color: string;
  rect?: { x: number; y: number; w: number; h: number }; // en mètres sur le plan
  sellable: boolean; // l'espace caisse n'est pas un lieu de stockage
  description?: string;
  order: number;
}

export interface Category extends Base {
  name: string;
  order: number;
}

export interface PriceTier {
  minQty: number;
  price: number;
}

export interface Product extends Base {
  name: string;
  ref?: string;
  categoryId: string;
  dimensions?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  tiers?: PriceTier[]; // prix dégressifs par quantité (ex : à partir de 20 sacs)
  minStock: number; // seuil d'alerte « stock bas »
  locationId: string; // emplacement principal
  supplierIds: string[];
  notes?: string;
  archived?: boolean;
  createdAt: number;
}

export interface Movement extends Base {
  productId: string;
  locationId: string;
  qty: number; // + entrée, − sortie
  type: MoveType;
  refId?: string;
  userId: string;
  at: number;
  note?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number; // prix réellement appliqué (après négociation)
  listPrice: number; // prix catalogue au moment de la vente
  cost: number; // prix d'achat au moment de la vente (pour la marge)
  locationId: string;
  returnedQty?: number;
}

export interface Sale extends Base {
  number: string;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  total: number;
  paid: number; // montant encaissé au moment de la vente
  method: PayMethod;
  userId: string;
  at: number;
  cancelled?: boolean;
}

export interface Payment extends Base {
  clientId: string;
  amount: number; // positif = le client rembourse ; négatif = remboursement au client
  method: Exclude<PayMethod, 'credit'>;
  saleId?: string;
  userId: string;
  at: number;
  note?: string;
  /** 'reprise' = dette reprise du cahier papier (aucun argent ne bouge). */
  kind?: 'reprise';
}

export interface Client extends Base {
  name: string;
  phone?: string;
  notes?: string;
  createdAt: number;
}

export interface Supplier extends Base {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: number;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  unitCost: number;
  locationId: string;
}

export interface Purchase extends Base {
  supplierId: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  total: number;
  userId: string;
  at: number;
  notes?: string;
}

export interface InventoryLine {
  productId: string;
  expected: number;
  counted?: number;
}

export interface Inventory extends Base {
  locationId: string;
  status: 'en_cours' | 'valide' | 'abandonne';
  lines: InventoryLine[];
  userId: string;
  startedAt: number;
  validatedAt?: number;
}

export interface User extends Base {
  name: string;
  role: Role;
  pinHash: string;
  active: boolean;
  color: string;
}

export interface AuditEntry extends Base {
  userId: string;
  action: string;
  detail?: string;
  at: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** Cache local du stock (dérivé des mouvements, jamais synchronisé, reconstructible). */
export interface StockRow {
  productId: string;
  locationId: string;
  qty: number;
}

export interface OutboxEntry {
  seq?: number;
  table: string;
  id: string;
  at: number;
}

export class AppDB extends Dexie {
  locations!: Table<Location, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  movements!: Table<Movement, string>;
  sales!: Table<Sale, string>;
  payments!: Table<Payment, string>;
  clients!: Table<Client, string>;
  suppliers!: Table<Supplier, string>;
  purchases!: Table<Purchase, string>;
  inventories!: Table<Inventory, string>;
  users!: Table<User, string>;
  audit!: Table<AuditEntry, string>;
  settings!: Table<Setting, string>;
  outbox!: Table<OutboxEntry, number>;
  stock!: Table<StockRow, [string, string]>;

  constructor() {
    super('ayoka-quinca');
    this.version(1).stores({
      locations: 'id, parentId, order',
      categories: 'id, order',
      products: 'id, categoryId, locationId, name, archived',
      movements: 'id, productId, locationId, [productId+locationId], type, at, refId',
      sales: 'id, number, clientId, userId, at',
      payments: 'id, clientId, saleId, at',
      clients: 'id, name',
      suppliers: 'id, name',
      purchases: 'id, supplierId, at',
      inventories: 'id, locationId, status, startedAt',
      users: 'id',
      audit: 'id, at, userId',
      settings: 'key',
      outbox: '++seq, table',
      stock: '[productId+locationId], productId, locationId',
    });
  }
}

export const db = new AppDB();

/** Tables synchronisées avec le serveur. */
export const SYNC_TABLES = [
  'locations',
  'categories',
  'products',
  'movements',
  'sales',
  'payments',
  'clients',
  'suppliers',
  'purchases',
  'inventories',
  'users',
  'audit',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export function getDeviceId(): string {
  let id = localStorage.getItem('aq.device');
  if (!id) {
    id = uid();
    localStorage.setItem('aq.device', id);
  }
  return id;
}

/** Code court de l'appareil (préfixe des numéros de vente, évite les doublons hors ligne). */
export function getDeviceCode(): string {
  let c = localStorage.getItem('aq.deviceCode');
  if (!c) {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    c = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    localStorage.setItem('aq.deviceCode', c);
  }
  return c;
}

/** Écrit des enregistrements et les met en file d'envoi. À appeler dans une transaction incluant db.outbox. */
export async function write<T extends Base>(table: SyncTable, records: T | T[]): Promise<void> {
  const list = Array.isArray(records) ? records : [records];
  const now = Date.now();
  const deviceId = getDeviceId();
  for (const r of list) {
    r.updatedAt = now;
    r.deviceId = deviceId;
  }
  await (db[table] as unknown as Table<T, string>).bulkPut(list);
  await db.outbox.bulkAdd(list.map((r) => ({ table, id: r.id, at: now })));
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export interface Company {
  name: string;
  owner: string;
  address: string;
  phone: string;
  email: string;
  ifu?: string;
  footer: string;
}

export const DEFAULT_COMPANY: Company = {
  name: 'AYOKA QUINCA',
  owner: 'Mme MOURITALA Sofiatou',
  address: 'Sèmè-Podji, Maison ADAM',
  phone: '01 96 42 52 81',
  email: 'mouritalacisf@gmail.com',
  ifu: '',
  footer: 'Merci pour votre confiance !',
};
