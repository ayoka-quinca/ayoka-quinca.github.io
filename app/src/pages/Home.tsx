import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Search, HandCoins, Truck, AlertTriangle, ChevronRight, Banknote, Smartphone, TrendingUp, Users } from 'lucide-react';
import { db } from '../db';
import { can } from '../domain/auth';
import { money, startOfDay, when, PAY_LABEL } from '../domain/format';
import { saleNet } from '../domain/ops';
import { useBalances, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { StockBadge, TopBar, ZoneTag } from '../ui/kit';

export default function HomePage() {
  const { user } = useSession();
  const nav = useNavigate();
  const today = startOfDay(Date.now());
  const weekStart = today - 6 * 86400000;
  const data = useLiveQuery(async () => {
    const [sales, pays, purchases] = await Promise.all([
      db.sales.where('at').aboveOrEqual(weekStart).toArray(),
      db.payments.where('at').aboveOrEqual(weekStart).toArray(),
      db.purchases.where('at').aboveOrEqual(weekStart).toArray(),
    ]);
    return { sales: sales.filter((s) => !s.cancelled), pays, purchases };
  }, [weekStart]);
  const products = useProducts();
  const stock = useStockMap();
  const balances = useBalances();
  const { map: locs } = useLocations();

  const todaySales = data?.sales.filter((s) => s.at >= today) ?? [];
  const todayPays = data?.pays.filter((p) => p.at >= today && !p.kind) ?? [];
  const ca = todaySales.reduce((t, s) => t + saleNet(s), 0);
  const cash = todaySales.filter((s) => s.method === 'especes' || s.method === 'credit').reduce((t, s) => t + s.paid, 0) + todayPays.filter((p) => p.method === 'especes').reduce((t, p) => t + p.amount, 0);
  const momo = todaySales.filter((s) => s.method === 'mtn' || s.method === 'moov').reduce((t, s) => t + s.paid, 0) + todayPays.filter((p) => p.method !== 'especes').reduce((t, p) => t + p.amount, 0);
  const margin = todaySales.reduce((t, s) => t + s.items.reduce((m, i) => m + (i.qty - (i.returnedQty ?? 0)) * (i.unitPrice - i.cost), 0), 0);
  const owed = [...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const debtors = [...balances.values()].filter((b) => b > 0).length;

  const alerts = products
    .map((p) => ({ p, q: stock.get(p.id) ?? 0 }))
    .filter(({ p, q }) => q <= p.minStock)
    .sort((a, b) => a.q - b.q);

  const days = Array.from({ length: 7 }, (_, i) => {
    const s = weekStart + i * 86400000;
    const v = (data?.sales ?? []).filter((x) => x.at >= s && x.at < s + 86400000).reduce((t, x) => t + saleNet(x), 0);
    return { s, v, label: new Date(s).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '') };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.v));

  const activity = [
    ...(data?.sales ?? []).map((s) => ({ at: s.at, to: `/ventes/${s.id}`, icon: ShoppingCart, title: `Vente ${money(saleNet(s))}`, sub: `${s.clientName ?? 'Client de passage'} · ${PAY_LABEL[s.method]}` })),
    ...(data?.pays ?? []).filter((p) => !p.kind).map((p) => ({ at: p.at, to: `/clients/${p.clientId}`, icon: HandCoins, title: p.amount >= 0 ? `Remboursement reçu ${money(p.amount)}` : `Argent rendu ${money(-p.amount)}`, sub: PAY_LABEL[p.method] })),
    ...(can(user, 'achats') ? data?.purchases ?? [] : []).map((p) => ({ at: p.at, to: '/achats', icon: Truck, title: `Achat ${money(p.total)}`, sub: `${p.items.length} article(s) reçus` })),
  ].sort((a, b) => b.at - a.at).slice(0, 7);

  const hour = new Date().getHours();
  return (
    <>
      <TopBar title={`${hour < 13 ? 'Bonjour' : 'Bonsoir'} ${user.name}`} right={<span className="muted small hide-m" />} />
      <main className="main stack-lg">
        <div className="grid-4">
          {can(user, 'vendre') && (
            <button className="action-tile main" onClick={() => nav('/vendre')}><span className="ic"><ShoppingCart size={26} /></span>Nouvelle vente</button>
          )}
          <button className="action-tile" onClick={() => nav('/stock?focus=1')}><span className="ic"><Search size={24} /></span>Trouver un produit</button>
          {can(user, 'encaisser_credit') && (
            <button className="action-tile" onClick={() => nav('/clients')}><span className="ic"><HandCoins size={24} /></span>Encaisser un crédit</button>
          )}
          {can(user, 'achats') && (
            <button className="action-tile" onClick={() => nav('/achats/nouveau')}><span className="ic"><Truck size={24} /></span>Réception marchandise</button>
          )}
        </div>

        <section className="stack">
          <div className="section-title"><h2>Aujourd'hui</h2><Link to="/ventes" className="small ok-t" style={{ fontWeight: 700 }}>Voir les ventes</Link></div>
          <div className="grid-4">
            <div className="card stat"><div className="label"><ShoppingCart size={16} />Ventes</div><div className="value">{money(ca)}</div><div className="hint">{todaySales.length} vente{todaySales.length > 1 ? 's' : ''}</div></div>
            <div className="card stat"><div className="label"><Banknote size={16} />Espèces reçues</div><div className="value">{money(cash)}</div><div className="hint">À trouver dans la caisse</div></div>
            <div className="card stat"><div className="label"><Smartphone size={16} />Mobile Money</div><div className="value">{money(momo)}</div><div className="hint">MTN + Moov</div></div>
            {can(user, 'voir_prix_achat') ? (
              <div className="card stat"><div className="label"><TrendingUp size={16} />Bénéfice</div><div className="value ok-t">{money(margin)}</div><div className="hint">Ventes − prix d'achat</div></div>
            ) : (
              <div className="card stat"><div className="label"><Users size={16} />Crédits en cours</div><div className="value">{money(owed)}</div><div className="hint">{debtors} client(s)</div></div>
            )}
          </div>
        </section>

        <div className="split">
          <section className="stack">
            <div className="section-title">
              <h2><AlertTriangle size={18} style={{ verticalAlign: '-3px', color: 'var(--warn)' }} /> À commander ({alerts.length})</h2>
              <Link to="/stock?f=alerte" className="small ok-t" style={{ fontWeight: 700 }}>Tout voir</Link>
            </div>
            {alerts.length === 0 ? (
              <div className="card tint-ok">Aucun produit en manque. 👍</div>
            ) : (
              <div className="list">
                {alerts.slice(0, 6).map(({ p, q }) => (
                  <Link key={p.id} to={`/stock/${p.id}`} className="item">
                    <div className="grow"><div className="title">{p.name}</div><ZoneTag loc={locs.get(p.locationId)} locs={locs} /></div>
                    <div className="end"><StockBadge q={q} min={p.minStock} unit={p.unit} /></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="stack">
            {can(user, 'rapports') && (
              <>
                <div className="section-title"><h2>7 derniers jours</h2><Link to="/rapports" className="small ok-t" style={{ fontWeight: 700 }}>Rapports</Link></div>
                <div className="card">
                  <div className="bars" aria-label="Ventes des 7 derniers jours">
                    {days.map((d) => (
                      <div key={d.s} className={`b ${d.s === today ? 'today' : ''}`} title={money(d.v)}>
                        <span className="num" style={{ fontSize: '.62rem' }}>{d.v ? Math.round(d.v / 1000) + 'k' : ''}</span>
                        <i style={{ height: `${(d.v / maxDay) * 100}%` }} />
                        <span>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {can(user, 'clients') && (
              <Link to="/clients" className="card row between">
                <div><div className="label small muted" style={{ fontWeight: 600 }}>Les clients me doivent</div><div className="big danger-t num">{money(owed)}</div></div>
                <div className="row muted small">{debtors} client{debtors > 1 ? 's' : ''}<ChevronRight size={20} /></div>
              </Link>
            )}
          </section>
        </div>

        <section className="stack">
          <div className="section-title"><h2>Dernières opérations</h2></div>
          <div className="list">
            {activity.length === 0 && <div className="empty">Rien pour le moment.</div>}
            {activity.map((a, i) => (
              <Link key={i} to={a.to} className="item">
                <span className="iconbtn" style={{ background: 'var(--surface-2)' }}><a.icon size={20} /></span>
                <div className="grow"><div className="title num">{a.title}</div><div className="sub">{a.sub}</div></div>
                <div className="end small muted">{when(a.at)}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
