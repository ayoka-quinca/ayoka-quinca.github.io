import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download } from 'lucide-react';
import { db } from '../db';
import { money, qty as fq, startOfDay, dateShort, PAY_LABEL } from '../domain/format';
import { saleNet } from '../domain/ops';
import { download } from '../domain/backup';
import { useClients, useProducts, useStockMap, useSuppliers, useUsers } from '../ui/hooks';
import { TopBar } from '../ui/kit';

const PERIODS = [
  { k: 'j', label: "Aujourd'hui", from: () => startOfDay(Date.now()) },
  { k: '7', label: '7 jours', from: () => startOfDay(Date.now()) - 6 * 86400000 },
  { k: '30', label: '30 jours', from: () => startOfDay(Date.now()) - 29 * 86400000 },
  { k: 'm', label: 'Ce mois', from: () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); } },
];

function Bars({ rows, fmt = money }: { rows: { label: string; v: number; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row between small"><span style={{ fontWeight: 600 }}>{r.label}</span><span className="num">{fmt(r.v)}{r.sub && <span className="muted"> · {r.sub}</span>}</span></div>
          <div className="hbar"><i style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </div>
      ))}
      {rows.length === 0 && <div className="muted small">Pas de données sur la période.</div>}
    </div>
  );
}

export default function ReportsPage() {
  const [pk, setPk] = useState('30');
  const from = PERIODS.find((p) => p.k === pk)!.from();
  const data = useLiveQuery(async () => {
    const [sales, pays, purchases, moves] = await Promise.all([
      db.sales.where('at').aboveOrEqual(from).toArray(),
      db.payments.where('at').aboveOrEqual(from).toArray(),
      db.purchases.where('at').aboveOrEqual(from).toArray(),
      db.movements.where('at').aboveOrEqual(from).toArray(),
    ]);
    return { sales: sales.filter((s) => !s.cancelled), pays, purchases, moves };
  }, [from]);
  const users = useUsers();
  const clients = useClients();
  const suppliers = useSuppliers();
  const products = useProducts();
  const stock = useStockMap();

  const r = useMemo(() => {
    if (!data) return null;
    const { sales, pays, purchases, moves } = data;
    const ca = sales.reduce((t, s) => t + saleNet(s), 0);
    const cost = sales.reduce((t, s) => t + s.items.reduce((m, i) => m + (i.qty - (i.returnedQty ?? 0)) * i.cost, 0), 0);
    const credit = sales.reduce((t, s) => t + Math.max(0, saleNet(s) - s.paid), 0);
    const recovered = pays.filter((p) => p.amount > 0 && !p.kind).reduce((t, p) => t + p.amount, 0);
    const byProduct = new Map<string, { name: string; v: number; q: number; unit: string; m: number }>();
    for (const s of sales) for (const i of s.items) {
      const q = i.qty - (i.returnedQty ?? 0);
      const e = byProduct.get(i.productId) ?? { name: i.name, v: 0, q: 0, unit: i.unit, m: 0 };
      e.v += q * i.unitPrice; e.q += q; e.m += q * (i.unitPrice - i.cost);
      byProduct.set(i.productId, e);
    }
    const group = <T,>(list: T[], key: (x: T) => string, val: (x: T) => number) => {
      const m = new Map<string, number>();
      for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + val(x));
      return [...m].sort((a, b) => b[1] - a[1]);
    };
    const losses = moves.filter((m) => m.type === 'perte' || m.type === 'inventaire');
    const discount = sales.reduce((t, s) => t + s.items.reduce((m, i) => m + Math.max(0, i.listPrice - i.unitPrice) * i.qty, 0), 0);
    return {
      ca, margin: ca - cost, credit, recovered, n: sales.length, avg: sales.length ? ca / sales.length : 0, discount,
      buy: purchases.reduce((t, p) => t + p.total, 0),
      top: [...byProduct.values()].sort((a, b) => b.v - a.v).slice(0, 10),
      byPay: group(sales, (s) => s.method, (s) => saleNet(s)),
      byUser: group(sales, (s) => s.userId, (s) => saleNet(s)),
      byClient: group(sales.filter((s) => s.clientId), (s) => s.clientId!, (s) => saleNet(s)).slice(0, 8),
      bySupplier: group(purchases, (p) => p.supplierId, (p) => p.total),
      losses: losses.length, lossQty: losses.reduce((t, m) => t + m.qty, 0),
      sales,
    };
  }, [data]);

  const sleeping = products.filter((p) => (stock.get(p.id) ?? 0) > 0 && !r?.top.some((t) => t.name === p.name) && !data?.sales.some((s) => s.items.some((i) => i.productId === p.id)));
  const cmap = new Map(clients.map((c) => [c.id, c.name]));
  const smap = new Map(suppliers.map((s) => [s.id, s.name]));

  const exportCsv = () => {
    if (!r) return;
    const rows = [['Date', 'N°', 'Client', 'Produit', 'Quantité', 'Unité', 'Prix unitaire', 'Prix catalogue', 'Montant', 'Paiement', 'Vendeur']];
    for (const s of r.sales) for (const i of s.items) rows.push([dateShort(s.at), s.number, s.clientName ?? '', i.name, String(i.qty - (i.returnedQty ?? 0)), i.unit, String(i.unitPrice), String(i.listPrice), String((i.qty - (i.returnedQty ?? 0)) * i.unitPrice), PAY_LABEL[s.method], users.get(s.userId)?.name ?? '']);
    download(new Blob(['﻿' + rows.map((x) => x.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv' }), `ventes-${pk}.csv`);
  };

  return (
    <>
      <TopBar title="Rapports" right={<button className="btn ghost" onClick={exportCsv}><Download size={18} />Excel</button>} />
      <main className="main stack-lg">
        <div className="seg">{PERIODS.map((p) => <button key={p.k} className={pk === p.k ? 'on' : ''} onClick={() => setPk(p.k)}>{p.label}</button>)}</div>
        {r && (
          <>
            <div className="grid-4">
              <div className="card stat"><div className="label">Chiffre d'affaires</div><div className="value">{money(r.ca)}</div><div className="hint">{r.n} ventes · panier moyen {money(r.avg)}</div></div>
              <div className="card stat"><div className="label">Bénéfice brut</div><div className="value ok-t">{money(r.margin)}</div><div className="hint">{r.ca ? Math.round((r.margin / r.ca) * 100) : 0} % du CA</div></div>
              <div className="card stat"><div className="label">Achats fournisseurs</div><div className="value">{money(r.buy)}</div></div>
              <div className="card stat"><div className="label">Crédits accordés</div><div className="value danger-t">{money(r.credit)}</div><div className="hint">Récupérés : {money(r.recovered)}</div></div>
            </div>
            {r.discount > 0 && <div className="banner info">Remises accordées en négociation sur la période : {money(r.discount)}</div>}
            <div className="split">
              <div className="card stack"><h2>Produits qui rapportent le plus</h2><Bars rows={r.top.map((t) => ({ label: t.name, v: t.v, sub: `${fq(t.q)} ${t.unit}` }))} /></div>
              <div className="stack">
                <div className="card stack"><h2>Par mode de paiement</h2><Bars rows={r.byPay.map(([k, v]) => ({ label: PAY_LABEL[k], v }))} /></div>
                <div className="card stack"><h2>Par vendeur</h2><Bars rows={r.byUser.map(([k, v]) => ({ label: users.get(k)?.name ?? '—', v }))} /></div>
              </div>
            </div>
            <div className="split">
              <div className="card stack"><h2>Meilleurs clients</h2><Bars rows={r.byClient.map(([k, v]) => ({ label: cmap.get(k) ?? '—', v }))} /></div>
              <div className="card stack"><h2>Achats par fournisseur</h2><Bars rows={r.bySupplier.map(([k, v]) => ({ label: smap.get(k) ?? '—', v }))} /></div>
            </div>
            <div className="split">
              <div className="card stack">
                <h2>Produits qui dorment</h2>
                <div className="small muted">En stock mais aucune vente sur la période — argent immobilisé.</div>
                <div className="row-wrap">{sleeping.slice(0, 20).map((p) => <span key={p.id} className="badge neutral">{p.name} ({fq(stock.get(p.id) ?? 0)})</span>)}{sleeping.length === 0 && <span className="muted small">Aucun 👍</span>}</div>
              </div>
              <div className="card stack">
                <h2>Corrections de stock</h2>
                <div>{r.losses} correction(s) / perte(s) · solde {fq(r.lossQty)} unités</div>
                <div className="small muted">Beaucoup de corrections négatives = vol, casse ou ventes oubliées.</div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
