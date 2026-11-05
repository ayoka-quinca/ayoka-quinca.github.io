/**
 * Synchronisation « hors ligne d'abord ».
 *
 * 1. Toute écriture locale ajoute une entrée dans `outbox`.
 * 2. Dès qu'Internet est disponible, on ENVOIE la file (push), puis on RÉCUPÈRE
 *    ce que les autres appareils ont envoyé depuis le dernier passage (pull).
 * 3. Règle de fusion : le plus récent gagne (updatedAt). Les mouvements de stock,
 *    ventes et paiements sont créés une seule fois et jamais modifiés en concurrence,
 *    donc pas de conflit sur les quantités.
 */
import { db, getSetting, setSetting, SYNC_TABLES, type SyncTable } from '../db';
import { rebuildStock } from './ops';

export interface SyncConfig {
  url: string;
  token: string;
}

export interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error' | 'offline';
  pending: number;
  lastSync?: number;
  error?: string;
}

let state: SyncState = { status: 'off', pending: 0 };
const listeners = new Set<(s: SyncState) => void>();
export function onSync(fn: (s: SyncState) => void) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
function emit(p: Partial<SyncState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l(state));
}

let running = false;

export async function syncNow(): Promise<void> {
  const cfg = await getSetting<SyncConfig | null>('sync', null);
  const pending = await db.outbox.count();
  if (!cfg?.url) return emit({ status: 'off', pending });
  if (!navigator.onLine) return emit({ status: 'offline', pending });
  if (running) return;
  running = true;
  emit({ status: 'syncing', pending });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` };
  const base = cfg.url.replace(/\/$/, '');
  try {
    // PUSH par lots de 200
    for (;;) {
      const batch = await db.outbox.orderBy('seq').limit(200).toArray();
      if (!batch.length) break;
      const records = [];
      const seen = new Set<string>();
      for (const e of batch) {
        const key = e.table + e.id;
        if (seen.has(key)) continue;
        seen.add(key);
        const data = await (db as any)[e.table].get(e.id);
        if (data) records.push({ table: e.table, id: e.id, updatedAt: data.updatedAt, data });
      }
      const r = await fetch(`${base}/sync/push`, { method: 'POST', headers, body: JSON.stringify({ records }) });
      if (!r.ok) throw new Error(`Envoi refusé (${r.status})`);
      await db.outbox.bulkDelete(batch.map((b) => b.seq!));
      emit({ pending: await db.outbox.count() });
    }
    // PULL
    let cursor = await getSetting<number>('syncCursor', 0);
    let movementsChanged = false;
    for (;;) {
      const r = await fetch(`${base}/sync/pull?since=${cursor}`, { headers });
      if (!r.ok) throw new Error(`Réception refusée (${r.status})`);
      const body: { records: { table: SyncTable; id: string; data: any }[]; cursor: number; more: boolean } = await r.json();
      await db.transaction('rw', SYNC_TABLES.map((t) => db[t]), async () => {
        for (const rec of body.records) {
          if (!SYNC_TABLES.includes(rec.table)) continue;
          const table = (db as any)[rec.table];
          const local = await table.get(rec.id);
          if (!local || (rec.data.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
            await table.put(rec.data);
            if (rec.table === 'movements') movementsChanged = true;
          }
        }
      });
      cursor = body.cursor;
      await setSetting('syncCursor', cursor);
      if (!body.more) break;
    }
    if (movementsChanged) await rebuildStock();
    emit({ status: 'idle', lastSync: Date.now(), error: undefined, pending: await db.outbox.count() });
  } catch (e) {
    emit({ status: navigator.onLine ? 'error' : 'offline', error: String((e as Error).message ?? e) });
  } finally {
    running = false;
  }
}

export function startSyncLoop() {
  syncNow();
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => emit({ status: 'offline' }));
  setInterval(syncNow, 30000);
}
