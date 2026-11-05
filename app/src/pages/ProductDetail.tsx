import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, Pencil, ShoppingCart, SlidersHorizontal, MapPin } from 'lucide-react';
import { db, type Location, type MoveType, type Product } from '../db';
import { can } from '../domain/auth';
import { money, qty as fq, when, waLink } from '../domain/format';
import { adjust, transfer } from '../domain/ops';
import { useLocations, useSession, useSuppliers, useUsers } from '../ui/hooks';
import { Field, Sheet, Stepper, StockBadge, TopBar, ZoneTag, useToast } from '../ui/kit';
import { StoreMap } from '../ui/StoreMap';

export const MOVE_LABEL: Record<MoveType, string> = {
  achat: 'Réception achat', vente: 'Vente', retour: 'Retour client', inventaire: 'Correction inventaire',
  transfert: 'Déplacement', perte: 'Perte / casse', initial: 'Stock de départ',
};

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const nav = useNavigate();
  const p = useLiveQuery(() => db.products.get(id!), [id]);
  const rows = useLiveQuery(() => db.stock.where('productId').equals(id!).toArray(), [id]) ?? [];
  const moves = useLiveQuery(() => db.movements.where('productId').equals(id!).reverse().sortBy('at'), [id]) ?? [];
  const { list: locList, map: locs } = useLocations();
  const suppliers = useSuppliers();
  const users = useUsers();
  const [sheet, setSheet] = useState<'move' | 'adjust' | null>(null);
  if (!p) return null;
  const total = rows.reduce((t, r) => t + r.qty, 0);
  const here = rows.filter((r) => r.qty !== 0);
  const highlight = new Set([p.locationId, ...here.map((r) => r.locationId)]);
  const sellNow = () => {
    const cart = JSON.parse(sessionStorage.getItem('aq.cart') ?? '[]');
    if (!cart.some((l: { productId: string }) => l.productId === p.id)) cart.push({ productId: p.id, qty: 1, unitPrice: p.salePrice, custom: false });
    sessionStorage.setItem('aq.cart', JSON.stringify(cart));
    nav('/vendre');
  };
  return (
    <>
      <TopBar back="/stock" title={p.name} right={can(user, 'modifier_produits') && <button className="btn ghost" onClick={() => nav(`/stock/${p.id}/modifier`)}><Pencil size={18} />Modifier</button>} />
      <main className="main stack-lg">
        <div className="split">
          <div className="stack">
            <div className="card stack">
              <div className="row between">
                <div>
                  <div className="small muted" style={{ fontWeight: 600 }}>En stock</div>
                  <div className="huge num">{fq(total)} <span style={{ fontSize: '1rem' }} className="muted">{p.unit}</span></div>
                </div>
                <StockBadge q={total} min={p.minStock} unit={p.unit} />
              </div>
              <div className="small muted">Alerte quand il reste {fq(p.minStock)} {p.unit} ou moins{p.dimensions && ` · ${p.dimensions}`}{p.ref && ` · Réf. ${p.ref}`}</div>
              <div className="grid-2">
                {can(user, 'vendre') && <button className="btn primary lg" onClick={sellNow}><ShoppingCart size={20} />Vendre</button>}
                {can(user, 'deplacer_stock') && <button className="btn lg" onClick={() => setSheet('move')}><ArrowRightLeft size={20} />Déplacer</button>}
                {can(user, 'ajuster_stock') && <button className="btn lg" onClick={() => setSheet('adjust')}><SlidersHorizontal size={20} />Corriger</button>}
              </div>
            </div>

            <div className="card stack">
              <h2>Prix</h2>
              <div className="row between"><span>Prix de vente</span><strong className="num big">{money(p.salePrice)}</strong></div>
              {p.tiers?.map((t) => <div key={t.minQty} className="row between small"><span>À partir de {t.minQty} {p.unit}</span><strong className="num">{money(t.price)}</strong></div>)}
              {can(user, 'voir_prix_achat') && (
                <div className="row between small muted"><span>Prix d'achat</span><span className="num">{money(p.purchasePrice)} · marge {money(p.salePrice - p.purchasePrice)}</span></div>
              )}
            </div>
            {p.notes && <div className="card"><div className="small muted" style={{ fontWeight: 600 }}>Observations</div>{p.notes}</div>}
          </div>

          <div className="stack">
            <div className="card stack">
              <h2><MapPin size={18} style={{ verticalAlign: '-3px' }} /> Où le trouver</h2>
              <StoreMap locations={locList} highlight={highlight} compact />
              <div className="list">
                {(here.length ? here : [{ locationId: p.locationId, qty: 0 }]).map((r) => (
                  <div key={r.locationId} className="item">
                    <div className="grow"><ZoneTag loc={locs.get(r.locationId)} locs={locs} />{r.locationId === p.locationId && <div className="sub">Emplacement principal</div>}</div>
                    <strong className="num">{fq(r.qty)} {p.unit}</strong>
                  </div>
                ))}
              </div>
            </div>
            {p.supplierIds.length > 0 && can(user, 'achats') && (
              <div className="card stack">
                <h2>Fournisseurs</h2>
                {suppliers.filter((s) => p.supplierIds.includes(s.id)).map((s) => (
                  <div key={s.id} className="row between"><span>{s.name}</span>{s.phone && <a className="btn soft" href={waLink(s.phone, `Bonjour, ici ${'AYOKA QUINCA'}. Je voudrais commander : ${p.name}.`)} target="_blank">WhatsApp</a>}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <section className="stack">
          <div className="section-title"><h2>Historique des mouvements</h2></div>
          <div className="list">
            {moves.slice(0, 60).map((m) => (
              <div key={m.id} className="item">
                <div className="grow">
                  <div className="title">{MOVE_LABEL[m.type]}</div>
                  <div className="sub">{when(m.at)} · {users.get(m.userId)?.name ?? '—'} · {locs.get(m.locationId)?.name}{m.note ? ` · ${m.note}` : ''}</div>
                </div>
                <strong className={`num ${m.qty < 0 ? 'danger-t' : 'ok-t'}`}>{m.qty > 0 ? '+' : ''}{fq(m.qty)}</strong>
              </div>
            ))}
            {moves.length === 0 && <div className="empty small">Aucun mouvement</div>}
          </div>
        </section>
      </main>
      {sheet === 'move' && <MoveSheet p={p} rows={here} locs={locList} onClose={() => setSheet(null)} />}
      {sheet === 'adjust' && <AdjustSheet p={p} rows={rows} locs={locList} onClose={() => setSheet(null)} />}
    </>
  );
}

function MoveSheet({ p, rows, locs, onClose }: { p: Product; rows: { locationId: string; qty: number }[]; locs: Location[]; onClose: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [from, setFrom] = useState(rows.find((r) => r.qty > 0)?.locationId ?? p.locationId);
  const [to, setTo] = useState('');
  const avail = rows.find((r) => r.locationId === from)?.qty ?? 0;
  const [q, setQ] = useState(Math.max(1, avail));
  const [main, setMain] = useState(true);
  const targets = locs.filter((l) => l.sellable && l.id !== from);
  return (
    <Sheet title="Déplacer le produit" onClose={onClose}>
      <div className="stack">
        <Field label="Depuis">
          <select className="input lg" value={from} onChange={(e) => setFrom(e.target.value)}>
            {locs.filter((l) => l.sellable).map((l) => <option key={l.id} value={l.id}>{l.name} ({fq(rows.find((r) => r.locationId === l.id)?.qty ?? 0)})</option>)}
          </select>
        </Field>
        <Field label="Vers">
          <div className="row-wrap">
            {targets.map((l) => (
              <button key={l.id} className={`chip ${to === l.id ? 'on' : ''}`} onClick={() => setTo(l.id)}><i style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />{l.name}</button>
            ))}
          </div>
        </Field>
        <Field label={`Quantité (${p.unit})`}><Stepper value={q} min={0} onChange={setQ} /></Field>
        <label className="row"><input type="checkbox" checked={main} onChange={(e) => setMain(e.target.checked)} style={{ width: 22, height: 22 }} />En faire l'emplacement principal</label>
        <button className="btn primary lg" disabled={!to || q <= 0} onClick={async () => { await transfer(p, from, to, q, user.id, main); toast({ text: 'Produit déplacé' }); onClose(); }}>Déplacer {fq(q)} {p.unit}</button>
      </div>
    </Sheet>
  );
}

function AdjustSheet({ p, rows, locs, onClose }: { p: Product; rows: { locationId: string; qty: number }[]; locs: Location[]; onClose: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [loc, setLoc] = useState(p.locationId);
  const current = rows.find((r) => r.locationId === loc)?.qty ?? 0;
  const [real, setReal] = useState(current);
  const [reason, setReason] = useState<MoveType>('inventaire');
  const [note, setNote] = useState('');
  const delta = real - current;
  return (
    <Sheet title="Corriger le stock" onClose={onClose}>
      <div className="stack">
        <Field label="Emplacement">
          <select className="input lg" value={loc} onChange={(e) => { setLoc(e.target.value); setReal(rows.find((r) => r.locationId === e.target.value)?.qty ?? 0); }}>
            {locs.filter((l) => l.sellable).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <div className="row between"><span>Le système compte</span><strong className="num">{fq(current)} {p.unit}</strong></div>
        <Field label="Quantité réellement présente"><Stepper value={real} onChange={setReal} /></Field>
        <div className="seg">
          <button className={reason === 'inventaire' ? 'on' : ''} onClick={() => setReason('inventaire')}>Erreur de comptage</button>
          <button className={reason === 'perte' ? 'on' : ''} onClick={() => setReason('perte')}>Perte / casse</button>
        </div>
        <Field label="Explication (obligatoire)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : 2 sacs mouillés" /></Field>
        {delta !== 0 && <div className={`banner ${delta < 0 ? 'warn' : 'info'}`}>Écart : {delta > 0 ? '+' : ''}{fq(delta)} {p.unit}</div>}
        <button className="btn primary lg" disabled={delta === 0 || !note.trim()} onClick={async () => { await adjust(p, loc, delta, reason, user.id, note.trim()); toast({ text: 'Stock corrigé' }); onClose(); }}>Enregistrer la correction</button>
      </div>
    </Sheet>
  );
}
