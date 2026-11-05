import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Truck } from 'lucide-react';
import { db } from '../db';
import { matches, money, qty as fq, when } from '../domain/format';
import { useSuppliers } from '../ui/hooks';
import { Empty, SearchBox, Sheet, TopBar } from '../ui/kit';
import type { Purchase } from '../db';

export default function PurchasesPage() {
  const nav = useNavigate();
  const purchases = useLiveQuery(() => db.purchases.orderBy('at').reverse().toArray(), []) ?? [];
  const suppliers = useSuppliers();
  const sup = new Map(suppliers.map((s) => [s.id, s]));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Purchase | null>(null);
  const list = purchases.filter((p) => matches(`${sup.get(p.supplierId)?.name ?? ''} ${p.invoiceNumber ?? ''} ${p.items.map((i) => i.name).join(' ')}`, q));
  const month = purchases.filter((p) => p.at > Date.now() - 30 * 86400000).reduce((t, p) => t + p.total, 0);
  return (
    <>
      <TopBar title="Achats" right={<button className="btn primary" onClick={() => nav('/achats/nouveau')}><Plus size={20} />Réception</button>} />
      <main className="main stack">
        <div className="card row between"><div><div className="small muted">Achats des 30 derniers jours</div><div className="big num">{money(month)}</div></div></div>
        <SearchBox value={q} onChange={setQ} placeholder="Fournisseur, n° de facture, produit…" />
        {list.length === 0 ? <Empty icon={Truck} title="Aucun achat" text="Enregistrez chaque livraison : le stock se met à jour tout seul." /> : (
          <div className="list">
            {list.map((p) => (
              <button key={p.id} className="item" onClick={() => setOpen(p)}>
                <div className="grow"><div className="title">{sup.get(p.supplierId)?.name ?? 'Fournisseur'}</div><div className="sub">{when(p.at)}{p.invoiceNumber && ` · Facture ${p.invoiceNumber}`} · {p.items.length} article(s)</div></div>
                <strong className="num">{money(p.total)}</strong>
              </button>
            ))}
          </div>
        )}
      </main>
      {open && (
        <Sheet title={`Facture ${open.invoiceNumber ?? ''}`} onClose={() => setOpen(null)}>
          <div className="stack">
            <div className="muted">{sup.get(open.supplierId)?.name} · {when(open.at)}</div>
            <div className="list">
              {open.items.map((i, k) => <div key={k} className="item"><div className="grow"><div className="title">{i.name}</div><div className="sub num">{fq(i.qty)} × {money(i.unitCost)}</div></div><strong className="num">{money(i.qty * i.unitCost)}</strong></div>)}
            </div>
            <div className="row between"><strong>Total</strong><span className="big num">{money(open.total)}</span></div>
            {open.notes && <div className="small muted">{open.notes}</div>}
          </div>
        </Sheet>
      )}
    </>
  );
}
