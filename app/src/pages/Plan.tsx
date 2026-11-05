import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { db, write, uid } from '../db';
import { can } from '../domain/auth';
import { matches, qty as fq } from '../domain/format';
import { rootOf, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { Field, SearchBox, Sheet, StockBadge, TopBar, ZoneTag } from '../ui/kit';
import { StoreMap } from '../ui/StoreMap';

export default function PlanPage() {
  const { user } = useSession();
  const { list, map } = useLocations();
  const products = useProducts();
  const stock = useStockMap();
  const [sel, setSel] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [shelfName, setShelfName] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const z = rootOf(map.get(p.locationId), map);
      if (z) m.set(z.id, (m.get(z.id) ?? 0) + 1);
    }
    return m;
  }, [products, map]);

  const found = q ? products.filter((p) => matches(`${p.name} ${p.dimensions ?? ''}`, q)).slice(0, 12) : [];
  const highlight = new Set(found.map((p) => p.locationId));
  const selLoc = sel ? map.get(sel) : undefined;
  const zoneProducts = sel ? products.filter((p) => p.locationId === sel || map.get(p.locationId)?.parentId === sel) : [];
  const shelves = sel ? list.filter((l) => l.parentId === (selLoc?.parentId ?? sel)) : [];

  return (
    <>
      <TopBar title="Plan du magasin" />
      <main className="main stack">
        <SearchBox value={q} onChange={(v) => { setQ(v); setSel(undefined); }} placeholder="Où se trouve… (ex : coude 32)" />
        <div className="split">
          <div className="card" style={{ padding: 10 }}>
            <StoreMap locations={list} selected={sel} highlight={highlight} counts={counts} onSelect={(id) => { setSel(id === sel ? undefined : id); setQ(''); }} />
            {!sel && !q && <div className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>Touchez une zone pour voir ce qu'elle contient</div>}
          </div>
          <div className="stack">
            {q && (
              <div className="list">
                {found.map((p) => (
                  <Link key={p.id} to={`/stock/${p.id}`} className="item">
                    <div className="grow"><div className="title">{p.name}</div><ZoneTag loc={map.get(p.locationId)} locs={map} /></div>
                    <StockBadge q={stock.get(p.id) ?? 0} min={p.minStock} unit={p.unit} />
                  </Link>
                ))}
                {found.length === 0 && <div className="empty small">Aucun produit trouvé</div>}
              </div>
            )}
            {selLoc && (
              <>
                <div className="card stack" style={{ borderLeft: `6px solid ${selLoc.color}` }}>
                  <h2>{selLoc.parentId ? `${map.get(selLoc.parentId)?.name} · ${selLoc.name}` : selLoc.name}</h2>
                  {selLoc.description && <div className="small muted">{selLoc.description}</div>}
                  {selLoc.rect && !selLoc.parentId && <div className="small muted">{fq(selLoc.rect.w)} m × {fq(selLoc.rect.h)} m</div>}
                  {shelves.length > 0 && (
                    <div className="row-wrap">
                      {shelves.map((s) => <button key={s.id} className={`chip ${sel === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>{s.name}</button>)}
                    </div>
                  )}
                  {can(user, 'parametres') && selLoc.sellable && (
                    <button className="btn soft" onClick={() => setAdding(true)}><Plus size={18} />Ajouter une étagère / un rayon ici</button>
                  )}
                </div>
                <div className="list">
                  {zoneProducts.map((p) => (
                    <Link key={p.id} to={`/stock/${p.id}`} className="item">
                      <div className="grow"><div className="title">{p.name}</div><ZoneTag loc={map.get(p.locationId)} locs={map} /></div>
                      <StockBadge q={stock.get(p.id) ?? 0} min={p.minStock} unit={p.unit} />
                    </Link>
                  ))}
                  {zoneProducts.length === 0 && <div className="empty small">Aucun produit rangé ici</div>}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      {adding && selLoc && (
        <Sheet title="Nouvelle étagère" onClose={() => setAdding(false)}>
          <div className="stack">
            <Field label="Nom" hint="Ex : Étagère E, Rayon peinture, Carton 12"><input className="input lg" value={shelfName} onChange={(e) => setShelfName(e.target.value)} autoFocus /></Field>
            <button className="btn primary lg" disabled={!shelfName.trim()} onClick={async () => {
              const parent = selLoc.parentId ? map.get(selLoc.parentId)! : selLoc;
              await db.transaction('rw', db.locations, db.outbox, () => write('locations', {
                id: uid(), code: `${parent.code}-${shelfName.trim().toUpperCase().replace(/\W+/g, '').slice(0, 6)}`, name: shelfName.trim(),
                parentId: parent.id, color: parent.color, sellable: true, order: 100 + list.length, updatedAt: 0,
              }));
              setShelfName(''); setAdding(false);
            }}>Ajouter</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
