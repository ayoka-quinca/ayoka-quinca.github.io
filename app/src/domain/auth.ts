import { db, write, uid, type Role, type User } from '../db';

/** Rôles et droits. Les libellés sont ceux que l'équipe utilise au quotidien. */
export const ROLE_LABEL: Record<Role, string> = {
  responsable: 'Responsable',
  caissiere: 'Caisse',
  employe: 'Vendeur / Magasin',
};

export type Perm =
  | 'vendre'
  | 'voir_prix_achat'
  | 'modifier_produits'
  | 'ajuster_stock'
  | 'deplacer_stock'
  | 'achats'
  | 'inventaire'
  | 'valider_inventaire'
  | 'clients'
  | 'encaisser_credit'
  | 'annuler_vente'
  | 'rapports'
  | 'parametres';

const PERMS: Record<Role, Perm[]> = {
  responsable: [
    'vendre', 'voir_prix_achat', 'modifier_produits', 'ajuster_stock', 'deplacer_stock', 'achats',
    'inventaire', 'valider_inventaire', 'clients', 'encaisser_credit', 'annuler_vente', 'rapports', 'parametres',
  ],
  caissiere: ['vendre', 'clients', 'encaisser_credit'],
  employe: ['vendre', 'deplacer_stock', 'inventaire'],
};

export function can(user: User | undefined | null, perm: Perm): boolean {
  return !!user && user.active && PERMS[user.role].includes(perm);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Repli (contexte non sécurisé) – ne devrait pas arriver en HTTPS.
  let h = 0;
  for (const b of data) h = (h * 31 + b) | 0;
  return 'w' + h.toString(16);
}

export async function checkPin(user: User, pin: string): Promise<boolean> {
  return (await hashPin(pin, user.id)) === user.pinHash;
}

export async function createUser(name: string, role: Role, pin: string, color: string): Promise<User> {
  const id = uid();
  const user: User = { id, name, role, pinHash: await hashPin(pin, id), active: true, color, updatedAt: 0 };
  await db.transaction('rw', db.users, db.outbox, () => write('users', user));
  return user;
}

export async function setPin(user: User, pin: string) {
  const u = { ...user, pinHash: await hashPin(pin, user.id) };
  await db.transaction('rw', db.users, db.outbox, () => write('users', u));
}

export async function audit(userId: string, action: string, detail?: string) {
  await db.transaction('rw', db.audit, db.outbox, () =>
    write('audit', { id: uid(), userId, action, detail, at: Date.now(), updatedAt: 0 }),
  );
}
