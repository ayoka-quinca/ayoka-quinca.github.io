import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Plus, Lock, Info } from 'lucide-react';
import { db, type Inventory } from '../db';
import { can } from '../domain/auth';
import { matches, money, qty as fq } from '../domain/format';
import { saveInventory, validateInventory } from '../domain/ops';
import { useLocations, useProducts, useSession } from '../ui/hooks';
import { Confirm, SearchBox, Sheet, Stepper, TopBar, ZoneTag, useToast } from '../ui/kit';
import { dateShort, time } from '../domain/format';

/** Comptage : chaque ligne montre ce que le système attend ; on saisit ce qu'on voit. */
export default function InventoryCount() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useSession();
  const stored = useLiveQuery(() => db.inventories.get(id!), [id]);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [q, setQ] = useState('');
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [aq, setAq] = useState('');
  const stockHere = useLiveQuery(() => (stored ? db.stock.where('locationId').equals(stored.locationId).toArray() : []), [stored?.locationId]) ?? [];
  const products = useProducts();
  const { map } = useLocations();
  const pmap = new Map(products.map((p) => [p.id, p]));
  useEffect(() => { if (stored && !inv) setInv(stored); }, [stored, inv]);
  // Sauvegarde automatique : on peut quitter et reprendre plus tard.
  useEffect(() => { if (inv && inv.status === 'en_cours') { const t = setTimeout(() => saveInventory(inv), 400); return () => clearTimeout(t); } }, [inv]);
  if (!inv) return null;
  const done = inv.status !== 'en_cours';
  const counted = inv.lines.filter((l) => l.counted !== undefined).length;
  const gaps = inv.lines.filter((l) => l.counted !== undefined && l.counted !== l.expected);
  const gapValue = gaps.reduce((t, l) => t + ((l.counted as number) - l.expected) * (pmap.get(l.productId)?.purchasePrice ?? 0), 0);
  const lines = inv.lines.filter((l) => matches(pmap.get(l.productId)?.name ?? '', q) && (!onlyLeft || l.counted === undefined));
  const set = (pid: string, n: number | undefined) => setInv({ ...inv, lines: inv.lines.map((l) => (l.productId === pid ? { ...l, counted: n } : l)) });

  return (
    <>
      <TopBar back="/inventaire" title={<>Inventaire · {map.get(inv.locationId)?.name}</>} />
      <main className="main stack" style={{ maxWidth: 820 }}>
        <div className="card stack">
          <ZoneTag loc={map.get(inv.locationId)} locs={map} />
          <div className="row between"><span>Comptés</span><strong className="num">{counted} / {inv.lines.length}</strong></div>
          <div className="hbar"><i style={{ width: `${(counted / Math.max(1, inv.lines.length)) * 100}%` }} /></div>
          {gaps.length > 0 && <div className="banner warn">{gaps.length} écart(s){can(user, 'voir_prix_achat') && ` · valeur ${money(gapValue)}`}</div>}
        </div>
        {done && (
          <div className="banner info"><Lock size={18} />Inventaire validé le {dateShort(inv.validatedAt ?? inv.startedAt)} à {time(inv.validatedAt ?? inv.startedAt)} : le stock a déjà été corrigé, ce comptage ne se modifie plus. Pour rectifier, lancez un nouvel inventaire de la zone ou corrigez le produit depuis sa fiche.</div>
        )}
        {!done && !can(user, 'valider_inventaire') && (
          <div className="banner info"><Info size={18} />Comptez librement, tout est enregistré au fur et à mesure. La responsable vérifiera et validera.</div>
        )}
        {!done && (
          <>
            <SearchBox value={q} onChange={setQ} placeholder="Chercher dans la zone…" />
            <label className="row"><input type="checkbox" checked={onlyLeft} onChange={(e) => setOnlyLeft(e.target.checked)} style={{ width: 22, height: 22 }} />Seulement ce qui reste à compter</label>
          </>
        )}
        <div className="list">
          {lines.map((l) => {
            const p = pmap.get(l.productId);
            if (!p) return null;
            const diff = l.counted !== undefined ? l.counted - l.expected : 0;
            return (
              <div key={l.productId} className="item" style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ minWidth: 160 }}>
                  <div className="title">{p.name}</div>
                  <div className="sub">Le système compte {fq(l.expected)} {p.unit}{diff !== 0 && <strong className={diff < 0 ? 'danger-t' : 'ok-t'}> · écart {diff > 0 ? '+' : ''}{fq(diff)}</strong>}</div>
                </div>
                {done ? (
                  <strong className="num">{l.counted !== undefined ? fq(l.counted) : '—'}</strong>
                ) : l.counted === undefined ? (
                  <div className="row">
                    <button className="btn soft" onClick={() => set(p.id, l.expected)}>C'est juste ({fq(l.expected)})</button>
                    <button className="btn" onClick={() => set(p.id, l.expected)}>Corriger</button>
                  </div>
                ) : (
                  <div className="row"><Stepper value={l.counted} onChange={(n) => set(p.id, n)} /><button className="btn ghost sm" onClick={() => set(p.id, undefined)}>Annuler</button></div>
                )}
              </div>
            );
          })}
        </div>
        {!done && <button className="btn lg" onClick={() => { setAq(''); setAdding(true); }}><Plus size={18} />J'ai trouvé un produit qui n'est pas dans la liste</button>}
        {!done && (
          can(user, 'valider_inventaire') ? (
            <button className="btn primary lg block" disabled={counted === 0} onClick={() => setConfirm(true)}><CheckCircle2 size={22} />Terminer et corriger le stock</button>
          ) : (
            <div className="banner info">Votre comptage est enregistré. La responsable le validera.</div>
          )
        )}
      </main>
      {adding && (
        <Sheet title="Ajouter un produit au comptage" onClose={() => setAdding(false)}>
          <div className="stack">
            <div className="small muted">Le produit sera compté ici, dans « {map.get(inv.locationId)?.name} ». S'il ne devrait pas être là, déplacez-le ensuite depuis sa fiche.</div>
            <SearchBox value={aq} onChange={setAq} placeholder="Chercher un produit…" autoFocus />
            <div className="list" style={{ maxHeight: '50dvh', overflowY: 'auto' }}>
              {products.filter((p) => !inv.lines.some((l) => l.productId === p.id) && matches(p.name, aq)).slice(0, 40).map((p) => (
                <button key={p.id} className="item" onClick={() => {
                  const expected = stockHere.find((r) => r.productId === p.id)?.qty ?? 0;
                  setInv({ ...inv, lines: [{ productId: p.id, expected, counted: expected }, ...inv.lines] });
                  setAdding(false); toast({ text: `${p.name} ajouté : indiquez la quantité vue` });
                }}>
                  <span className="title grow">{p.name}</span><Plus size={18} className="muted" />
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
      {confirm && (
        <Confirm title="Valider l'inventaire ?" confirm="Oui, corriger le stock" onClose={() => setConfirm(false)}
          text={<>{gaps.length} produit(s) seront corrigés. Les produits non comptés ({inv.lines.length - counted}) ne seront pas modifiés.</>}
          onYes={async () => { await validateInventory(inv, user.id); toast({ text: 'Inventaire validé' }); nav('/inventaire'); }} />
      )}
    </>
  );
}
