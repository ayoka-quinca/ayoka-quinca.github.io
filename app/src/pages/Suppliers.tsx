import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Factory, Phone, MessageCircle, Pencil } from 'lucide-react';
import { db, type Supplier } from '../db';
import { money, when, waLink } from '../domain/format';
import { useProducts, useSuppliers } from '../ui/hooks';
import { Empty, Sheet, TopBar } from '../ui/kit';
import { SupplierSheet } from './PurchaseForm';

export default function SuppliersPage() {
  const suppliers = useSuppliers();
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const products = useProducts();
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null);
  const [open, setOpen] = useState<Supplier | null>(null);
  return (
    <>
      <TopBar title="Fournisseurs" right={<button className="btn primary" onClick={() => setEdit('new')}><Plus size={20} />Fournisseur</button>} />
      <main className="main stack">
        {suppliers.length === 0 ? <Empty icon={Factory} title="Aucun fournisseur" /> : (
          <div className="grid-auto">
            {suppliers.map((s) => {
              const ps = purchases.filter((p) => p.supplierId === s.id);
              const total = ps.reduce((t, p) => t + p.total, 0);
              const last = Math.max(0, ...ps.map((p) => p.at));
              return (
                <button key={s.id} className="card stack" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpen(s)}>
                  <h3>{s.name}</h3>
                  <div className="small muted">{s.address}</div>
                  <div className="row between small"><span>{ps.length} achat(s) · {money(total)}</span><span className="muted">{last ? when(last) : ''}</span></div>
                </button>
              );
            })}
          </div>
        )}
      </main>
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div className="stack">
            {open.phone && (
              <div className="grid-2">
                <a className="btn lg" href={`tel:${open.phone}`}><Phone size={20} />Appeler</a>
                <a className="btn lg" href={waLink(open.phone, 'Bonjour, ici AYOKA QUINCA. ')} target="_blank"><MessageCircle size={20} />WhatsApp</a>
              </div>
            )}
            <div className="label">Produits fournis</div>
            <div className="row-wrap">{products.filter((p) => p.supplierIds.includes(open.id)).map((p) => <span key={p.id} className="badge neutral">{p.name}</span>)}</div>
            <div className="label">Derniers achats</div>
            <div className="list">
              {purchases.filter((p) => p.supplierId === open.id).sort((a, b) => b.at - a.at).slice(0, 10).map((p) => (
                <div key={p.id} className="item"><div className="grow"><div className="title">{when(p.at)}</div><div className="sub">{p.invoiceNumber}</div></div><strong className="num">{money(p.total)}</strong></div>
              ))}
            </div>
            <button className="btn ghost" onClick={() => { setEdit(open); setOpen(null); }}><Pencil size={18} />Modifier</button>
          </div>
        </Sheet>
      )}
      {edit && <SupplierSheet supplier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  );
}
