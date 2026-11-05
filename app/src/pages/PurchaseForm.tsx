import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus } from 'lucide-react';
import { db, write, uid, type PurchaseItem, type Supplier } from '../db';
import { matches, money } from '../domain/format';
import { createPurchase } from '../domain/ops';
import { useLocations, useProducts, useSession, useSuppliers } from '../ui/hooks';
import { Field, SearchBox, Sheet, Stepper, TopBar, useToast } from '../ui/kit';

/** Réception de marchandise : en 3 étapes (fournisseur → articles → valider). */
export default function PurchaseForm() {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useSession();
  const suppliers = useSuppliers();
  const products = useProducts();
  const { list: locs } = useLocations();
  const [supplierId, setSupplierId] = useState('');
  const [invoice, setInvoice] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [newSup, setNewSup] = useState(false);
  const [updateCost, setUpdateCost] = useState(true);
  const total = items.reduce((t, i) => t + i.qty * i.unitCost, 0);
  const pmap = new Map(products.map((p) => [p.id, p]));
  const found = products.filter((p) => matches(p.name, q)).slice(0, 20);
  const setItem = (k: number, v: Partial<PurchaseItem>) => setItems(items.map((x, i) => (i === k ? { ...x, ...v } : x)));

  return (
    <>
      <TopBar back title="Réception de marchandise" />
      <main className="main">
        <div className="stack-lg" style={{ maxWidth: 760 }}>
          <div className="card stack">
            <h2>1. Fournisseur</h2>
            <div className="row-wrap">
              {suppliers.map((s) => <button key={s.id} className={`chip ${supplierId === s.id ? 'on' : ''}`} onClick={() => setSupplierId(s.id)}>{s.name}</button>)}
              <button className="chip" onClick={() => setNewSup(true)}><Plus size={16} />Nouveau</button>
            </div>
            <Field label="N° de la facture du fournisseur (facultatif)"><input className="input lg" value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
          </div>

          <div className="card stack">
            <h2>2. Ce qui a été livré</h2>
            {items.map((it, k) => {
              const p = pmap.get(it.productId);
              return (
                <div key={k} className="stack" style={{ gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                  <div className="row"><strong className="grow">{it.name}</strong><button className="iconbtn" aria-label="Retirer" onClick={() => setItems(items.filter((_, i) => i !== k))}><Trash2 size={20} /></button></div>
                  <div className="row-wrap" style={{ alignItems: 'center' }}>
                    <Stepper value={it.qty} min={0} onChange={(n) => setItem(k, { qty: n })} />
                    <span className="small">{p?.unit} à</span>
                    <input className="input num" style={{ width: 120 }} inputMode="numeric" value={it.unitCost || ''} onChange={(e) => setItem(k, { unitCost: Number(e.target.value.replace(/\D/g, '')) })} />
                    <span className="small">F</span>
                  </div>
                  <select className="input" value={it.locationId} onChange={(e) => setItem(k, { locationId: e.target.value })} aria-label="Rangé dans">
                    {locs.filter((l) => l.sellable).map((l) => <option key={l.id} value={l.id}>Rangé dans : {l.name}</option>)}
                  </select>
                </div>
              );
            })}
            <button className="btn soft lg" onClick={() => setAdding(true)}><Plus size={20} />Ajouter un produit livré</button>
          </div>

          <div className="card stack">
            <h2>3. Vérifier et valider</h2>
            <div className="row between"><span>Total de la facture</span><span className="big num">{money(total)}</span></div>
            <label className="row"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} style={{ width: 22, height: 22 }} />Mettre à jour les prix d'achat des produits</label>
            <button className="btn primary lg" disabled={!supplierId || !items.length || items.some((i) => i.qty <= 0)} onClick={async () => {
              await createPurchase({ supplierId, invoiceNumber: invoice.trim() || undefined, items, userId: user.id, updateCost });
              toast({ text: 'Réception enregistrée, stock mis à jour' }); nav('/achats', { replace: true });
            }}>Valider · ajouter au stock</button>
          </div>
        </div>
      </main>
      {adding && (
        <Sheet title="Quel produit ?" onClose={() => setAdding(false)}>
          <div className="stack">
            <SearchBox value={q} onChange={setQ} placeholder="Chercher…" autoFocus />
            <div className="list">
              {found.map((p) => (
                <button key={p.id} className="item" onClick={() => { setItems([...items, { productId: p.id, name: p.name, qty: 1, unitCost: p.purchasePrice, locationId: p.locationId }]); setAdding(false); setQ(''); }}>
                  <div className="grow"><div className="title">{p.name}</div><div className="sub num">Dernier prix d'achat : {money(p.purchasePrice)}</div></div>
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
      {newSup && <SupplierSheet onClose={() => setNewSup(false)} onSaved={(s) => { setSupplierId(s.id); setNewSup(false); }} />}
    </>
  );
}

export function SupplierSheet({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved?: (s: Supplier) => void }) {
  const [s, setS] = useState<Supplier>(supplier ?? { id: uid(), name: '', createdAt: Date.now(), updatedAt: 0 });
  return (
    <Sheet title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} onClose={onClose}>
      <div className="stack">
        <Field label="Nom"><input className="input lg" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus /></Field>
        <Field label="Téléphone"><input className="input lg" inputMode="tel" value={s.phone ?? ''} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
        <Field label="Adresse"><input className="input lg" value={s.address ?? ''} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
        <Field label="Notes"><textarea className="input" rows={2} value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
        <button className="btn primary lg" disabled={!s.name.trim()} onClick={async () => { await db.transaction('rw', db.suppliers, db.outbox, () => write('suppliers', s)); onSaved?.(s); onClose(); }}>Enregistrer</button>
      </div>
    </Sheet>
  );
}
