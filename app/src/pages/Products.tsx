import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package, Download, ChevronDown, MapPin, Tags, Check } from 'lucide-react';
import { can } from '../domain/auth';
import { matches, money } from '../domain/format';
import { download } from '../domain/backup';
import { rootOf, useCategories, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { Empty, SearchBox, Sheet, StockBadge, TopBar, ZoneTag } from '../ui/kit';
import { ProductGlyph } from '../ui/Brand';

export default function ProductsPage() {
  const { user } = useSession();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const products = useProducts();
  const stock = useStockMap();
  const { list: locList, map: locs } = useLocations();
  const { list: cats, map: catMap } = useCategories();
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState<'zone' | 'cat' | null>(null);
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

  const alerts = products.filter((p) => (stock.get(p.id) ?? 0) <= p.minStock).length;
  const out = products.filter((p) => (stock.get(p.id) ?? 0) <= 0).length;
  const value = list.reduce((t, p) => t + Math.max(0, stock.get(p.id) ?? 0) * p.purchasePrice, 0);
  const zones = locList.filter((l) => !l.parentId && l.sellable);
  const zoneSel = zone ? locs.get(zone) : undefined;
  const catSel = cat ? catMap.get(cat) : undefined;
  const rootLoc = (id: string) => rootOf(locs.get(id), locs);

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
          {can(user, 'modifier_produits') && <button className="btn primary" onClick={() => nav('/stock/nouveau')}><Plus size={18} />Produit</button>}
        </>
      } />
      <main className="main stack-lg">
        <div className="stack">
          <SearchBox value={q} onChange={setQ} placeholder="Nom, référence, dimension…" autoFocus={params.get('focus') === '1'} />
          <div className="seg">
            <button className={f === 'tous' ? 'on' : ''} onClick={() => setP('f', '')}>Tous</button>
            <button className={f === 'alerte' ? 'on' : ''} onClick={() => setP('f', 'alerte')}>Stock bas{alerts > 0 && <span className="count">{alerts}</span>}</button>
            <button className={f === 'epuise' ? 'on' : ''} onClick={() => setP('f', 'epuise')}>Épuisés{out > 0 && <span className="count">{out}</span>}</button>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className={`filterbtn ${zoneSel ? 'on' : ''}`} onClick={() => setPicker('zone')}>
              {zoneSel ? <span style={{ width: 9, height: 9, borderRadius: 5, background: zoneSel.color }} /> : <MapPin size={16} />}
              {zoneSel?.name ?? 'Toutes les zones'}<ChevronDown size={16} />
            </button>
            <button className={`filterbtn ${catSel ? 'on' : ''}`} onClick={() => setPicker('cat')}>
              <Tags size={16} />{catSel?.name ?? 'Toutes les catégories'}<ChevronDown size={16} />
            </button>
            <span className="grow" />
            <span className="small muted">{list.length} produit{list.length > 1 ? 's' : ''}{can(user, 'voir_prix_achat') && <span className="hide-m"> · valeur {money(value)}</span>}</span>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty icon={Package} title="Aucun produit" text={products.length ? 'Changez les filtres ou la recherche.' : 'Ajoutez vos produits ou importez votre liste depuis les Paramètres.'} />
        ) : (
          <>
            <div className="list hide-d">
              {list.map((p) => (
                <Link key={p.id} to={`/stock/${p.id}`} className="item">
                  <ProductGlyph category={catMap.get(p.categoryId)?.name} color={rootLoc(p.locationId)?.color} />
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <ZoneTag loc={locs.get(p.locationId)} locs={locs} />
                  </div>
                  <div className="end stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className="num" style={{ fontWeight: 700 }}>{money(p.salePrice)}</span>
                    <StockBadge q={stock.get(p.id) ?? 0} min={p.minStock} unit={p.unit} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="tablewrap hide-m">
              <table className="table">
                <thead>
                  <tr><th>Produit</th><th>Emplacement</th><th className="r">Stock</th><th className="r">Prix de vente</th>{can(user, 'voir_prix_achat') && <th className="r">Prix d'achat</th>}</tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} onClick={() => nav(`/stock/${p.id}`)}>
                      <td>
                        <div className="row" style={{ gap: 12 }}>
                          <ProductGlyph category={catMap.get(p.categoryId)?.name} color={rootLoc(p.locationId)?.color} size="sm" />
                          <div><div style={{ fontWeight: 650 }}>{p.name}</div><div className="tiny muted">{catMap.get(p.categoryId)?.name}{p.dimensions && ` · ${p.dimensions}`}</div></div>
                        </div>
                      </td>
                      <td><ZoneTag loc={locs.get(p.locationId)} locs={locs} /></td>
                      <td className="r"><StockBadge q={stock.get(p.id) ?? 0} min={p.minStock} unit={p.unit} /></td>
                      <td className="r num" style={{ fontWeight: 650 }}>{money(p.salePrice)}</td>
                      {can(user, 'voir_prix_achat') && <td className="r num muted">{money(p.purchasePrice)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      {picker && (
        <Sheet title={picker === 'zone' ? 'Quelle zone ?' : 'Quelle catégorie ?'} onClose={() => setPicker(null)}>
          <div className="list">
            {[{ id: '', name: picker === 'zone' ? 'Toutes les zones' : 'Toutes les catégories', color: undefined as string | undefined },
              ...(picker === 'zone' ? zones.map((z) => ({ id: z.id, name: z.name, color: z.color as string | undefined })) : cats.map((c) => ({ id: c.id, name: c.name, color: undefined })))].map((o) => {
              const on = (picker === 'zone' ? zone : cat) === o.id;
              return (
                <button key={o.id || 'all'} className="item" onClick={() => { setP(picker === 'zone' ? 'zone' : 'cat', o.id); setPicker(null); }}>
                  {picker === 'zone'
                    ? <span className="glyph sm" style={o.color ? { background: `color-mix(in srgb, ${o.color} 16%, var(--surface))`, color: o.color } : undefined}><MapPin size={17} /></span>
                    : <ProductGlyph category={o.name} size="sm" />}
                  <span className="title grow">{o.name}</span>
                  {on && <Check size={20} className="accent-t" />}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}
