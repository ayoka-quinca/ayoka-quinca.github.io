import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Search, HandCoins, Truck, ChevronRight, ArrowRight, FileText, Package, Users, ShieldAlert, Check, Upload } from 'lucide-react';
import { db } from '../db';
import { can } from '../domain/auth';
import { money, startOfDay, when, PAY_LABEL } from '../domain/format';
import { saleNet } from '../domain/ops';
import { useBalances, useProducts, useSession, useStockMap } from '../ui/hooks';
import { Avatar } from '../ui/Brand';

export default function HomePage() {
  const { user } = useSession();
  const nav = useNavigate();
  const today = startOfDay(Date.now());
  const weekStart = today - 6 * 86400000;
  const data = useLiveQuery(async () => {
    const [sales, pays, flags, users] = await Promise.all([
      db.sales.where('at').aboveOrEqual(weekStart).toArray(),
      db.payments.where('at').aboveOrEqual(weekStart).toArray(),
      db.audit.where('at').aboveOrEqual(today - 6 * 86400000).filter((a) => !!a.flag).count(),
      db.users.count(),
    ]);
    return { sales: sales.filter((s) => !s.cancelled), pays: pays.filter((p) => !p.kind), flags, users };
  }, [weekStart]);
  const products = useProducts();
  const stock = useStockMap();
  const balances = useBalances();

  const todaySales = data?.sales.filter((s) => s.at >= today) ?? [];
  const ca = todaySales.reduce((t, s) => t + saleNet(s), 0);
  const cashedToday = todaySales.reduce((t, s) => t + s.paid, 0) + (data?.pays ?? []).filter((p) => p.at >= today).reduce((t, p) => t + p.amount, 0);
  const owed = [...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const debtors = [...balances.values()].filter((b) => b > 0).length;
  const toOrder = products.filter((p) => (stock.get(p.id) ?? 0) <= p.minStock);
  const days = Array.from({ length: 7 }, (_, i) => {
    const s = weekStart + i * 86400000;
    return { s, v: (data?.sales ?? []).filter((x) => x.at >= s && x.at < s + 86400000).reduce((t, x) => t + saleNet(x), 0), label: new Date(s).toLocaleDateString('fr-FR', { weekday: 'narrow' }) };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.v));
  const recent = [
    ...(data?.sales ?? []).map((s) => ({ at: s.at, to: `/ventes/${s.id}`, title: s.clientName ?? 'Client de passage', sub: PAY_LABEL[s.method], v: saleNet(s), icon: ShoppingCart })),
    ...(data?.pays ?? []).filter((p) => p.amount > 0).map((p) => ({ at: p.at, to: `/clients/${p.clientId}`, title: 'Remboursement de crédit', sub: PAY_LABEL[p.method], v: p.amount, icon: HandCoins })),
  ].sort((a, b) => b.at - a.at).slice(0, 4);

  const hour = new Date().getHours();
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const watch = [
    toOrder.length > 0 && { to: '/stock?f=alerte', icon: Package, tone: 'warn', title: `${toOrder.length} produit${toOrder.length > 1 ? 's' : ''} à commander`, sub: toOrder.slice(0, 3).map((p) => p.name).join(', ') },
    can(user, 'clients') && debtors > 0 && { to: '/clients', icon: Users, tone: 'danger', title: `${money(owed)} de crédits en cours`, sub: `${debtors} client${debtors > 1 ? 's' : ''} vous doivent de l'argent` },
    can(user, 'rapports') && (data?.flags ?? 0) > 0 && { to: '/journal?f=alerte', icon: ShieldAlert, tone: 'accent', title: `${data!.flags} action${data!.flags > 1 ? 's' : ''} à vérifier`, sub: 'Remises, corrections de stock, prix modifiés' },
  ].filter(Boolean) as { to: string; icon: typeof Package; tone: string; title: string; sub: string }[];

  return (
    <main className="main stack-lg" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <header className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">{dateLabel}</span>
          <h1 className="display" style={{ fontSize: 'clamp(2.3rem, 7vw, 3.2rem)' }}>{hour < 13 ? 'Bonjour' : 'Bonsoir'}, <em>{user.name}</em></h1>
        </div>
        <Link to="/plus" className="hide-d" aria-label="Mon compte"><Avatar name={user.name} color={user.color} /></Link>
      </header>

      {products.length === 0 && can(user, 'parametres') && (
        <section className="card pad-lg stack">
          <span className="eyebrow">Pour bien démarrer</span>
          <h2>Trois étapes et la boutique est prête</h2>
          {[
            { done: false, t: 'Ajouter vos produits', s: 'Un par un, ou toute la liste d’un coup depuis Excel', to: '/parametres', icon: Upload },
            { done: (data?.users ?? 0) > 1, t: 'Créer les comptes de l’équipe', s: 'La caissière et le vendeur, chacun avec son code', to: '/parametres', icon: Users },
            { done: false, t: 'Faire une première vente', s: 'Pour voir le stock bouger tout seul', to: '/vendre', icon: ShoppingCart },
          ].map((x, i) => (
            <Link key={x.t} to={x.to} className="row" style={{ padding: '6px 0' }}>
              <span className="glyph sm" style={x.done ? { background: 'var(--ok-soft)', color: 'var(--ok)' } : undefined}>{x.done ? <Check size={18} /> : <span style={{ fontWeight: 800 }}>{i + 1}</span>}</span>
              <div className="grow"><div style={{ fontWeight: 650 }}>{x.t}</div><div className="small muted">{x.s}</div></div>
              <ChevronRight size={18} className="chev" />
            </Link>
          ))}
        </section>
      )}

      {can(user, 'vendre') && (
        <button className="hero-sell" onClick={() => nav('/vendre')}>
          <span className="stack" style={{ gap: 2 }}><span className="t">Nouvelle vente</span><span className="s">Comptant, Mobile Money ou à crédit</span></span>
          <span className="arrow"><ArrowRight size={24} /></span>
        </button>
      )}

      <Link to="/ventes" className="card dark pad-lg stack" style={{ gap: 18 }}>
        <div className="row between">
          <span className="eyebrow">Aujourd'hui</span>
          <span className="tiny" style={{ opacity: .7 }}>{todaySales.length} vente{todaySales.length > 1 ? 's' : ''}</span>
        </div>
        <div>
          <div className="huge num">{money(ca)}</div>
          <div className="small" style={{ opacity: .7, marginTop: 4 }}>{money(cashedToday)} encaissés</div>
        </div>
        {can(user, 'rapports') && (
          <div className="bars" style={{ height: 64 }} aria-label="Ventes des 7 derniers jours">
            {days.map((d) => (
              <div key={d.s} className={`b ${d.s === today ? 'today' : ''}`} title={money(d.v)}>
                <i style={{ height: `${Math.max(6, (d.v / maxDay) * 100)}%` }} />
                <span style={{ color: 'inherit', opacity: .6 }}>{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </Link>

      <div className="quick">
        <button onClick={() => nav('/stock?focus=1')}><span className="glyph"><Search size={21} /></span>Trouver un produit</button>
        {can(user, 'encaisser_credit')
          ? <button onClick={() => nav('/clients')}><span className="glyph"><HandCoins size={21} /></span>Encaisser un crédit</button>
          : <button onClick={() => nav('/plan')}><span className="glyph"><Package size={21} /></span>Plan du magasin</button>}
        {can(user, 'achats')
          ? <button onClick={() => nav('/achats/nouveau')}><span className="glyph"><Truck size={21} /></span>Réception</button>
          : <button onClick={() => nav('/proformas')}><span className="glyph"><FileText size={21} /></span>Proforma</button>}
      </div>

      {watch.length > 0 && (
        <section className="stack">
          <div className="section-title"><h2>À surveiller</h2></div>
          <div className="list">
            {watch.map((w) => (
              <Link key={w.to} to={w.to} className="item">
                <span className="glyph" style={{ background: `var(--${w.tone}-soft)`, color: `var(--${w.tone === 'accent' ? 'accent-ink' : w.tone})` }}><w.icon size={20} /></span>
                <div className="grow"><div className="title num">{w.title}</div><div className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.sub}</div></div>
                <ChevronRight size={18} className="chev" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="stack">
          <div className="section-title"><h2>Dernières opérations</h2><Link to={can(user, 'rapports') ? '/journal' : '/ventes'}>Tout voir</Link></div>
          <div className="list">
            {recent.map((a, i) => (
              <Link key={i} to={a.to} className="item">
                <span className="glyph sm"><a.icon size={17} /></span>
                <div className="grow"><div className="title">{a.title}</div><div className="sub">{when(a.at)} · {a.sub}</div></div>
                <strong className="num">{money(a.v)}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
