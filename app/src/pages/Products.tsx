import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package, Download } from 'lucide-react';
import { can } from '../domain/auth';
import { matches, money } from '../domain/format';
import { download } from '../domain/backup';
import { rootOf, useCategories, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { Empty, SearchBox, StockBadge, TopBar, ZoneTag } from '../ui/kit';

export default function ProductsPage() {
  const { user } = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const products = useProducts();
  const stock = useStockMap();
  const { list: locList, map: locs } = useLocations();
  const { list: cats, map: catMap } = useCategories();
  const [q, setQ] = useState('');
  const f = params.get('f') ?? 'tous';
  const zone = params.get('zone') ?? '';
  const cat = params.get('cat') ?? '';
  const setP = (k: string, v: string) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); n.delete('focus'); setParams(n, { replace: true }); };

  const list = useMemo(() => products.filter((p) => {
    const s = stock.get(p.id) ?? 0;
    if (f === 'alerte' && s > p.minStock) return false;
    if (f === 'epuise' && s > 0) return false;
    if (zone && rootOf(locs.get(p.locationId), locs)?.id !== zone) return false;
    if (cat && p.categoryId !== cat) return false;
    return matches(`${p.name} ${p.ref ?? ''} ${p.dimensions ?? ''} ${catMap.get(p.categoryId)?.name ?? ''}`, q);
  }), [products, stock, f, zone, cat, q, locs, catMap]);

  const value = list.reduce((t, p) => t + Math.max(0, stock.get(p.id) ?? 0) * p.purchasePrice, 0);
  const zones = locList.filter((l) => !l.parentId && l.sellable);

  const exportCsv = () => {
    const rows = [['Produit', 'Catégorie', 'Référence', 'Dimensions', 'Unité', 'Emplacement', 'Stock', 'Seuil', 'Prix vente', ...(can(user, 'voir_prix_achat') ? ['Prix achat'] : [])]];
    for (const p of list) rows.push([p.name, catMap.get(p.categoryId)?.name ?? '', p.ref ?? '', p.dimensions ?? '', p.unit, locs.get(p.locationId)?.name ?? '', String(stock.get(p.id) ?? 0), String(p.minStock), String(p.salePrice), ...(can(user, 'voir_prix_achat') ? [String(p.purchasePrice)] : [])]);
    download(new Blob(['﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), `stock-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <>
      <TopBar title="Stock" right={
        <>
          <button className="btn ghost hide-m" onClick={exportCsv}><Download size={18} />Exporter</button>
          {can(user, 'modifier_produits') && <button className="btn primary" onClick={() => nav('/stock/nouveau')}><Plus size={20} />Produit</button>}
        </>
      } />
      <main className="main stack">
        <SearchBox value={q} onChange={setQ} placeholder="Nom, référence, dimension…" autoFocus={params.get('focus') === '1'} />
        <div className="chips">
          {[['tous', 'Tous'], ['alerte', 'À commander'], ['epuise', 'Épuisés']].map(([k, l]) => (
            <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setP('f', k === 'tous' ? '' : k)}>{l}</button>
          ))}
          <span style={{ width: 1, background: 'var(--line)', flexShrink: 0 }} />
          {zones.map((z) => (
            <button key={z.id} className={`chip ${zone === z.id ? 'on' : ''}`} onClick={() => setP('zone', zone === z.id ? '' : z.id)}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: z.color }} />{z.name}
            </button>
          ))}
        </div>
        <div className="row between">
          <select className="input" style={{ maxWidth: 260 }} value={cat} onChange={(e) => setP('cat', e.target.value)} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="small muted">{list.length} produit{list.length > 1 ? 's' : ''}{can(user, 'voir_prix_achat') && <> · valeur {money(value)}</>}</span>
        </div>

        {list.length === 0 ? (
          <Empty icon={Package} title="Aucun produit" text={products.length ? 'Changez les filtres ou la recherche.' : 'Ajoutez vos produits ou importez votre liste depuis les Paramètres.'} />
        ) : (
          <>
            <div className="list hide-d">
              {list.map((p) => {
                const s = stock.get(p.id) ?? 0;
                return (
                  <Link key={p.id} to={`/stock/${p.id}`} className="item">
                    <div className="grow">
                      <div className="title">{p.name}</div>
                      <ZoneTag loc={locs.get(p.locationId)} locs={locs} />
                    </div>
                    <div className="end stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                      <StockBadge q={s} min={p.minStock} unit={p.unit} />
                      <span className="small muted num">{money(p.salePrice)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <table className="table hide-m card flat" style={{ padding: 0 }}>
              <thead>
                <tr><th>Produit</th><th>Catégorie</th><th>Emplacement</th><th className="r">Stock</th><th className="r">Prix vente</th>{can(user, 'voir_prix_achat') && <th className="r">Prix achat</th>}</tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const s = stock.get(p.id) ?? 0;
                  return (
                    <tr key={p.id} onClick={() => nav(`/stock/${p.id}`)}>
                      <td><strong>{p.name}</strong>{p.dimensions && <span className="muted small"> · {p.dimensions}</span>}</td>
                      <td className="muted">{catMap.get(p.categoryId)?.name}</td>
                      <td><ZoneTag loc={locs.get(p.locationId)} locs={locs} /></td>
                      <td className="r"><StockBadge q={s} min={p.minStock} unit={p.unit} /></td>
                      <td className="r num">{money(p.salePrice)}</td>
                      {can(user, 'voir_prix_achat') && <td className="r num muted">{money(p.purchasePrice)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </main>
    </>
  );
}
