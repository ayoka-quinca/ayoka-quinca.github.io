import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Archive } from 'lucide-react';
import { db, write, uid, type PriceTier, type Product } from '../db';
import { addMovements } from '../domain/ops';
import { useCategories, useLocations, useSession, useSuppliers } from '../ui/hooks';
import { Confirm, Field, TopBar, useToast } from '../ui/kit';

const UNITS = ['pièce', 'sac', 'barre', 'm²', 'mètre', 'feuille', 'kg', 'rouleau', 'carton', 'bidon', 'paquet', 'sachet'];

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useSession();
  const { list: cats } = useCategories();
  const { list: locs, map: locMap } = useLocations();
  const suppliers = useSuppliers();
  const [p, setP] = useState<Product | null>(null);
  const [initial, setInitial] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (id) db.products.get(id).then((x) => x && setP(x));
    else setP({ id: uid(), name: '', categoryId: '', unit: 'pièce', purchasePrice: 0, salePrice: 0, minStock: 5, locationId: '', supplierIds: [], createdAt: Date.now(), updatedAt: 0 });
  }, [id]);
  useEffect(() => {
    if (p && !p.categoryId && cats[0]) setP({ ...p, categoryId: cats[0].id });
    if (p && !p.locationId && locs[0]) setP({ ...p, locationId: locs.find((l) => l.code === 'MAG')?.id ?? locs[0].id });
  }, [p, cats, locs]);
  if (!p) return null;
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP({ ...p, [k]: v });
  const numIn = (k: 'purchasePrice' | 'salePrice' | 'minStock') => (
    <input className="input lg num" inputMode="numeric" value={p[k] || ''} onChange={(e) => set(k, Number(e.target.value.replace(/\D/g, '')))} />
  );
  const tiers = p.tiers ?? [];
  const setTier = (i: number, t: Partial<PriceTier>) => set('tiers', tiers.map((x, k) => (k === i ? { ...x, ...t } : x)));
  const valid = p.name.trim() && p.salePrice > 0 && p.categoryId && p.locationId;

  const save = async () => {
    await db.transaction('rw', [db.products, db.movements, db.stock, db.outbox], async () => {
      await write('products', { ...p, name: p.name.trim(), tiers: tiers.filter((t) => t.minQty > 0 && t.price > 0) });
      const q = Number(initial.replace(',', '.'));
      if (!id && q) await addMovements([{ productId: p.id, locationId: p.locationId, qty: q, type: 'initial', userId: user.id, at: Date.now(), note: 'Stock de départ' }]);
    });
    toast({ text: id ? 'Produit modifié' : 'Produit ajouté' });
    nav(`/stock/${p.id}`, { replace: true });
  };

  return (
    <>
      <TopBar back title={id ? 'Modifier le produit' : 'Nouveau produit'} />
      <main className="main">
        <div className="stack-lg" style={{ maxWidth: 720 }}>
          <div className="card stack">
            <Field label="Nom du produit"><input className="input lg" value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Fer à béton 10 mm" autoFocus={!id} /></Field>
            <div className="grid-2">
              <Field label="Catégorie">
                <select className="input lg" value={p.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
              <Field label="Dimensions / taille"><input className="input lg" value={p.dimensions ?? ''} onChange={(e) => set('dimensions', e.target.value)} placeholder="Ex : 12 m, 50 kg" /></Field>
            </div>
            <Field label="Se vend à l'unité de">
              <div className="row-wrap">{UNITS.map((u) => <button key={u} type="button" className={`chip ${p.unit === u ? 'on' : ''}`} onClick={() => set('unit', u)}>{u}</button>)}</div>
            </Field>
            <Field label="Référence (facultatif)"><input className="input" value={p.ref ?? ''} onChange={(e) => set('ref', e.target.value)} /></Field>
          </div>

          <div className="card stack">
            <h2>Prix (en francs CFA)</h2>
            <div className="grid-2">
              <Field label={`Prix de vente / ${p.unit}`}>{numIn('salePrice')}</Field>
              <Field label={`Prix d'achat / ${p.unit}`}>{numIn('purchasePrice')}</Field>
            </div>
            <div className="label">Prix de gros (facultatif)</div>
            {tiers.map((t, i) => (
              <div key={i} className="row">
                <span className="small">Dès</span>
                <input className="input num" style={{ width: 90 }} inputMode="numeric" value={t.minQty || ''} onChange={(e) => setTier(i, { minQty: Number(e.target.value) })} />
                <span className="small">{p.unit} →</span>
                <input className="input num grow" inputMode="numeric" value={t.price || ''} onChange={(e) => setTier(i, { price: Number(e.target.value) })} placeholder="Prix" />
                <button className="iconbtn" aria-label="Supprimer" onClick={() => set('tiers', tiers.filter((_, k) => k !== i))}><Trash2 size={20} /></button>
              </div>
            ))}
            <button className="btn soft" onClick={() => set('tiers', [...tiers, { minQty: 0, price: 0 }])}><Plus size={18} />Ajouter un prix de gros</button>
          </div>

          <div className="card stack">
            <h2>Stock et rangement</h2>
            <Field label="Emplacement principal">
              <select className="input lg" value={p.locationId} onChange={(e) => set('locationId', e.target.value)}>
                {locs.filter((l) => l.sellable).map((l) => <option key={l.id} value={l.id}>{l.parentId ? `${locMap.get(l.parentId)?.name} › ${l.name}` : l.name}</option>)}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="M'alerter quand il reste" hint={`en ${p.unit}`}>{numIn('minStock')}</Field>
              {!id && <Field label="Quantité en stock aujourd'hui"><input className="input lg num" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} /></Field>}
            </div>
            {suppliers.length > 0 && (
              <Field label="Fournisseurs">
                <div className="row-wrap">
                  {suppliers.map((s) => {
                    const on = p.supplierIds.includes(s.id);
                    return <button key={s.id} type="button" className={`chip ${on ? 'on' : ''}`} onClick={() => set('supplierIds', on ? p.supplierIds.filter((x) => x !== s.id) : [...p.supplierIds, s.id])}>{s.name}</button>;
                  })}
                </div>
              </Field>
            )}
            <Field label="Observations"><textarea className="input" rows={2} value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>

          <button className="btn primary lg block" disabled={!valid} onClick={save}>Enregistrer</button>
          {id && <button className="btn ghost danger-t" onClick={() => setConfirmArchive(true)}><Archive size={18} />Retirer ce produit du catalogue</button>}
        </div>
      </main>
      {confirmArchive && (
        <Confirm title="Retirer le produit ?" danger confirm="Oui, retirer" onClose={() => setConfirmArchive(false)}
          text="Il ne sera plus proposé à la vente. Son historique reste conservé dans les rapports."
          onYes={async () => { await db.transaction('rw', db.products, db.outbox, () => write('products', { ...p, archived: true })); nav('/stock', { replace: true }); }} />
      )}
    </>
  );
}
