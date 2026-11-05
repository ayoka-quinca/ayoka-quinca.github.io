import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Factory, Phone, MessageCircle, Pencil, X, Check, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, write, type Supplier } from '../db';
import { matches, money, when, waLink } from '../domain/format';
import { useProducts, useSuppliers } from '../ui/hooks';
import { Empty, SearchBox, Sheet, TopBar, useAction } from '../ui/kit';
import { SupplierSheet } from './PurchaseForm';

export default function SuppliersPage() {
  const nav = useNavigate();
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
            <SupplierProducts supplier={open} />
            <button className="btn lg" onClick={() => nav('/achats/nouveau')}><Truck size={18} />Enregistrer une livraison</button>
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
      {edit && <SupplierSheet supplier={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} onSaved={(s) => { if (edit === 'new') setOpen(s); }} />}
    </>
  );
}

/** Produits fournis par ce fournisseur : on peut en ajouter et en retirer. */
function SupplierProducts({ supplier }: { supplier: Supplier }) {
  const products = useProducts();
  const run = useAction();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const mine = products.filter((p) => p.supplierIds.includes(supplier.id));
  const toggle = async (ids: string[], add: boolean) => {
    const list = products.filter((p) => ids.includes(p.id)).map((p) => ({
      ...p, supplierIds: add ? [...new Set([...p.supplierIds, supplier.id])] : p.supplierIds.filter((x) => x !== supplier.id),
    }));
    await run(() => db.transaction('rw', db.products, db.outbox, () => write('products', list)), add ? `${list.length} produit(s) rattaché(s) à ${supplier.name}` : 'Produit retiré de ce fournisseur');
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row between"><span className="label">Produits fournis ({mine.length})</span><button className="btn sm" onClick={() => { setSel(new Set()); setPicking(true); }}><Plus size={16} />Ajouter</button></div>
      {mine.length === 0 ? (
        <div className="small muted">Aucun produit rattaché. Touchez « Ajouter » pour indiquer ce que ce fournisseur vous livre : vous saurez qui appeler quand un produit est en stock bas.</div>
      ) : (
        <div className="row-wrap">
          {mine.map((p) => (
            <span key={p.id} className="chip" style={{ cursor: 'default', paddingRight: 6 }}>{p.name}
              <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label={`Retirer ${p.name}`} onClick={() => toggle([p.id], false)}><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      {picking && (
        <Sheet title={`Produits livrés par ${supplier.name}`} onClose={() => setPicking(false)}>
          <div className="stack">
            <SearchBox value={q} onChange={setQ} placeholder="Chercher un produit…" autoFocus />
            <div className="list" style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
              {products.filter((p) => !p.supplierIds.includes(supplier.id) && matches(p.name, q)).map((p) => {
                const on = sel.has(p.id);
                return (
                  <button key={p.id} className="item" onClick={() => { const n = new Set(sel); on ? n.delete(p.id) : n.add(p.id); setSel(n); }}>
                    <span className="glyph sm" style={on ? { background: 'var(--ink)', color: 'var(--on-ink)' } : undefined}>{on ? <Check size={18} /> : <Plus size={16} />}</span>
                    <span className="title grow">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn primary lg" disabled={!sel.size} onClick={async () => { await toggle([...sel], true); setPicking(false); }}>
              {sel.size ? `Rattacher ${sel.size} produit(s)` : 'Sélectionnez des produits'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
