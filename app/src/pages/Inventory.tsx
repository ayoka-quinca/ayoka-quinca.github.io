import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { db } from '../db';
import { when } from '../domain/format';
import { startInventory } from '../domain/ops';
import { useLocations, useSession } from '../ui/hooks';
import { TopBar, ZoneTag } from '../ui/kit';

export default function InventoryPage() {
  const nav = useNavigate();
  const { user } = useSession();
  const { list, map } = useLocations();
  const invs = useLiveQuery(() => db.inventories.orderBy('startedAt').reverse().toArray(), []) ?? [];
  const running = invs.filter((i) => i.status === 'en_cours');
  return (
    <>
      <TopBar title="Inventaire" />
      <main className="main stack-lg">
        {running.length > 0 && (
          <section className="stack">
            <div className="section-title"><h2>En cours</h2></div>
            <div className="list">
              {running.map((i) => (
                <button key={i.id} className="item" onClick={() => nav(`/inventaire/${i.id}`)}>
                  <div className="grow"><ZoneTag loc={map.get(i.locationId)} locs={map} /><div className="sub">Commencé {when(i.startedAt)} · {i.lines.filter((l) => l.counted !== undefined).length}/{i.lines.length} comptés</div></div>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="stack">
          <div className="section-title"><h2>Compter une zone</h2></div>
          <div className="small muted">Conseil : comptez une zone à la fois, de préférence avant l'ouverture ou après la fermeture.</div>
          <div className="grid-auto">
            {list.filter((l) => l.sellable).map((l) => (
              <button key={l.id} className="action-tile" style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', borderLeft: `6px solid ${l.color}` }}
                onClick={async () => { const inv = await startInventory(l.id, user.id); nav(`/inventaire/${inv.id}`); }}>
                <span className="grow">{l.parentId ? `${map.get(l.parentId)?.name} · ${l.name}` : l.name}</span><ClipboardCheck />
              </button>
            ))}
          </div>
        </section>
        <section className="stack">
          <div className="section-title"><h2>Inventaires terminés</h2></div>
          <div className="list">
            {invs.filter((i) => i.status === 'valide').map((i) => {
              const gaps = i.lines.filter((l) => l.counted !== undefined && l.counted !== l.expected).length;
              return (
                <button key={i.id} className="item" onClick={() => nav(`/inventaire/${i.id}`)}>
                  <div className="grow"><ZoneTag loc={map.get(i.locationId)} locs={map} /><div className="sub">{when(i.validatedAt!)}</div></div>
                  <span className={`badge ${gaps ? 'warn' : 'ok'}`}>{gaps ? `${gaps} écart(s)` : 'Aucun écart'}</span>
                </button>
              );
            })}
            {!invs.some((i) => i.status === 'valide') && <div className="empty small">Aucun inventaire terminé</div>}
          </div>
        </section>
      </main>
    </>
  );
}
