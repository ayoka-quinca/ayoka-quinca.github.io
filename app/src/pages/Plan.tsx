import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, X } from 'lucide-react';
import { db, write, uid } from '../db';
import { can } from '../domain/auth';
import { matches, qty as fq } from '../domain/format';
import { rootOf, useCategories, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { Errors, Field, SearchBox, Sheet, StockBadge, TopBar, ZoneTag, useAction } from '../ui/kit';
import { ProductGlyph } from '../ui/Brand';
import { StoreMap } from '../ui/StoreMap';

export default function PlanPage() {
  const { user } = useSession();
  const run = useAction();
  const { list, map } = useLocations();
  const { map: cats } = useCategories();
  const products = useProducts();
  const stock = useStockMap();
  const [sel, setSel] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [shelfName, setShelfName] = useState('');
  const [tried, setTried] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const z = rootOf(map.get(p.locationId), map);
      if (z) m.set(z.id, (m.get(z.id) ?? 0) + 1);
    }
    return m;
  }, [products, map]);

  const zones = list.filter((l) => !l.parentId);
  const found = q ? products.filter((p) => matches(`${p.name} ${p.dimensions ?? ''}`, q)).slice(0, 12) : [];
  const highlight = new Set(found.map((p) => p.locationId));
  const selLoc = sel ? map.get(sel) : undefined;
  const zoneId = selLoc?.parentId ?? sel;
  const zone = zoneId ? map.get(zoneId) : undefined;
  const zoneProducts = sel ? products.filter((p) => p.locationId === sel || (!selLoc?.parentId && map.get(p.locationId)?.parentId === sel)) : [];
  const shelves = zoneId ? list.filter((l) => l.parentId === zoneId) : [];
  const exists = zoneId && shelves.some((s) => s.name.trim().toLowerCase() === shelfName.trim().toLowerCase());
  const shelfErrors = [!shelfName.trim() && 'Donnez un nom à l’étagère (ex : Étagère E).', exists && 'Une étagère porte déjà ce nom dans cette zone.'].filter(Boolean) as string[];

  const productRow = (p: (typeof products)[number]) => (
    <Link key={p.id} to={`/stock/${p.id}`} className="item">
      <ProductGlyph category={cats.get(p.categoryId)?.name} color={rootOf(map.get(p.locationId), map)?.color} size="sm" />
      <div className="grow"><div className="title">{p.name}</div><ZoneTag loc={map.get(p.locationId)} locs={map} /></div>
      <StockBadge q={stock.get(p.id) ?? 0} min={p.minStock} unit={p.unit} />
    </Link>
  );

  return (
    <>
      <TopBar title="Plan du magasin" />
      <main className="main stack-lg">
        <SearchBox value={q} onChange={(v) => { setQ(v); setSel(undefined); }} placeholder="Où se trouve… (ex : coude 32)" />

        <div className="card" style={{ padding: 12 }}>
          <div className="planbox">
            <StoreMap locations={list} selected={sel} highlight={highlight} counts={counts} onSelect={(id) => { setSel(id === sel ? undefined : id); setQ(''); }} />
          </div>
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 8 }}>
            Bâtiment de 20,2 m × 14,1 m · touchez une zone ou une étagère<span className="hide-d"> · glissez pour voir tout le plan</span>
          </div>
        </div>

        {q && (
          <section className="stack">
            <div className="section-title"><h2>{found.length ? `Trouvé dans ${new Set(found.map((p) => rootOf(map.get(p.locationId), map)?.id)).size} zone(s)` : 'Aucun produit trouvé'}</h2></div>
            {found.length > 0 && <div className="list">{found.map(productRow)}</div>}
          </section>
        )}

        {!q && !zone && (
          <section className="stack">
            <div className="section-title"><h2>Les zones</h2></div>
            <div className="legend">
              {zones.map((z) => (
                <button key={z.id} onClick={() => setSel(z.id)}>
                  <span className="sw" style={{ background: z.color }} />
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 700 }}>{z.name}</span>
                    <span className="tiny muted">{z.sellable ? `${counts.get(z.id) ?? 0} produit(s)` : 'Encaissement'}{z.rect ? ` · ${fq(z.rect.w)} × ${fq(z.rect.h)} m` : ''}</span>
                  </span>
                  <ChevronRight size={18} className="chev" />
                </button>
              ))}
            </div>
          </section>
        )}

        {zone && (
          <section className="stack">
            <div className="card stack" style={{ boxShadow: `inset 6px 0 0 ${zone.color}, var(--shadow-1)` }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="eyebrow">{selLoc?.parentId ? zone.name : 'Zone'}</span>
                  <h2>{selLoc?.name}</h2>
                  {zone.description && !selLoc?.parentId && <div className="small muted">{zone.description}</div>}
                </div>
                <button className="iconbtn" style={{ background: 'var(--surface-2)', width: 36, height: 36 }} aria-label="Fermer" onClick={() => setSel(undefined)}><X size={18} /></button>
              </div>
              {shelves.length > 0 && (
                <div className="chips">
                  <button className={`chip ${sel === zone.id ? 'on' : ''}`} onClick={() => setSel(zone.id)}>Toute la zone</button>
                  {shelves.map((s) => <button key={s.id} className={`chip ${sel === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>{s.name}</button>)}
                </div>
              )}
              {can(user, 'parametres') && zone.sellable && (
                <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setAdding(true); setTried(false); }}><Plus size={16} />Ajouter une étagère ici</button>
              )}
            </div>
            {zoneProducts.length ? <div className="list">{zoneProducts.map(productRow)}</div> : <div className="card small muted">Aucun produit n'est rangé ici pour l'instant. Ouvrez une fiche produit et choisissez cet emplacement.</div>}
          </section>
        )}
      </main>
      {adding && zone && (
        <Sheet title={`Nouvelle étagère · ${zone.name}`} onClose={() => setAdding(false)}>
          <div className="stack">
            <Field label="Nom" hint="Ex : Étagère E, Rayon peinture, Carton raccords 32"><input id="shelf-name" className="input lg" value={shelfName} onChange={(e) => setShelfName(e.target.value)} autoFocus /></Field>
            {tried && <Errors list={shelfErrors} />}
            <div className="small muted">L'étagère apparaît dans les listes et les fiches produits. Sa position sur le dessin se règle avec le prestataire.</div>
            <button className="btn primary lg" onClick={async () => {
              setTried(true);
              if (shelfErrors.length) return;
              await run(() => db.transaction('rw', db.locations, db.outbox, () => write('locations', {
                id: uid(), code: `${zone.code}-${shelfName.trim().toUpperCase().replace(/\W+/g, '').slice(0, 6)}`, name: shelfName.trim(),
                parentId: zone.id, color: zone.color, sellable: true, order: 100 + list.length, updatedAt: 0,
              })), `« ${shelfName.trim()} » ajoutée`);
              setShelfName(''); setAdding(false);
            }}>Ajouter l'étagère</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
