import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import { db, type Inventory } from '../db';
import { can } from '../domain/auth';
import { matches, money, qty as fq } from '../domain/format';
import { saveInventory, validateInventory } from '../domain/ops';
import { useLocations, useProducts, useSession } from '../ui/hooks';
import { Confirm, SearchBox, Stepper, TopBar, ZoneTag, useToast } from '../ui/kit';

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
                    <button className="btn" onClick={() => set(p.id, 0)}>Autre</button>
                  </div>
                ) : (
                  <div className="row"><Stepper value={l.counted} onChange={(n) => set(p.id, n)} /><button className="btn ghost small" onClick={() => set(p.id, undefined)}>Effacer</button></div>
                )}
              </div>
            );
          })}
        </div>
        {!done && (
          can(user, 'valider_inventaire') ? (
            <button className="btn primary lg block" disabled={counted === 0} onClick={() => setConfirm(true)}><CheckCircle2 size={22} />Terminer et corriger le stock</button>
          ) : (
            <div className="banner info">Votre comptage est enregistré. La responsable le validera.</div>
          )
        )}
      </main>
      {confirm && (
        <Confirm title="Valider l'inventaire ?" confirm="Oui, corriger le stock" onClose={() => setConfirm(false)}
          text={<>{gaps.length} produit(s) seront corrigés. Les produits non comptés ({inv.lines.length - counted}) ne seront pas modifiés.</>}
          onYes={async () => { await validateInventory(inv, user.id); toast({ text: 'Inventaire validé' }); nav('/inventaire'); }} />
      )}
    </>
  );
}
