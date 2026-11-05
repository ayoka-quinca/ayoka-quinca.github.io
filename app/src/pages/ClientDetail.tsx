import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HandCoins, MessageCircle, Phone, Pencil } from 'lucide-react';
import { db, write, type Client } from '../db';
import { can } from '../domain/auth';
import { money, when, waLink, PAY_LABEL } from '../domain/format';
import { recordPayment, saleNet } from '../domain/ops';
import { useSession } from '../ui/hooks';
import { applyKey, Field, NumPad, Sheet, TopBar, useToast } from '../ui/kit';
import { useCompany } from '../ui/Ticket';

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const company = useCompany();
  const c = useLiveQuery(() => db.clients.get(id!), [id]);
  const sales = useLiveQuery(() => db.sales.where('clientId').equals(id!).toArray(), [id]) ?? [];
  const pays = useLiveQuery(() => db.payments.where('clientId').equals(id!).toArray(), [id]) ?? [];
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [oldDebt, setOldDebt] = useState(false);
  if (!c) return null;
  const valid = sales.filter((s) => !s.cancelled);
  const balance = valid.reduce((t, s) => t + saleNet(s) - s.paid, 0) - pays.reduce((t, p) => t + p.amount, 0);
  const bought = valid.reduce((t, s) => t + saleNet(s), 0);
  const timeline = [
    ...valid.map((s) => ({ at: s.at, kind: 'sale' as const, s })),
    ...pays.map((p) => ({ at: p.at, kind: 'pay' as const, p })),
  ].sort((a, b) => b.at - a.at);
  const reminder = `Bonjour ${c.name}, ici ${company.name} (${company.phone}). Petit rappel amical : il reste ${money(balance, 'FCFA')} à régler sur vos achats. Vous pouvez payer en espèces ou par Mobile Money. Merci pour votre fidélité !`;
  return (
    <>
      <TopBar back="/clients" title={c.name} right={<button className="iconbtn" aria-label="Modifier" onClick={() => setEditing(true)}><Pencil size={20} /></button>} />
      <main className="main stack-lg">
        <div className="split">
          <div className={`card stack ${balance > 0 ? 'tint-danger' : 'tint-ok'}`}>
            <div className="small" style={{ fontWeight: 600 }}>{balance > 0 ? 'Doit encore' : balance < 0 ? 'Avoir en sa faveur' : 'Rien à payer'}</div>
            <div className="huge num">{money(Math.abs(balance))}</div>
            <div className="small">Total acheté : {money(bought)} · {valid.length} achat(s)</div>
            {balance > 0 && can(user, 'encaisser_credit') && <button className="btn primary lg" onClick={() => setPaying(true)}><HandCoins size={22} />Il paie maintenant</button>}
          </div>
          <div className="card stack">
            {c.phone ? (
              <>
                <a className="btn lg" href={`tel:${c.phone.replace(/\s/g, '')}`}><Phone size={20} />Appeler {c.phone}</a>
                {balance > 0 && <a className="btn lg" href={waLink(c.phone, reminder)} target="_blank"><MessageCircle size={20} />Rappel poli par WhatsApp</a>}
              </>
            ) : <div className="muted">Pas de numéro enregistré.</div>}
            {c.notes && <div className="small muted">{c.notes}</div>}
            {can(user, 'parametres') && <button className="btn ghost" onClick={() => setOldDebt(true)}>Reprendre une dette du cahier</button>}
          </div>
        </div>
        <section className="stack">
          <div className="section-title"><h2>Historique</h2></div>
          <div className="list">
            {timeline.map((t) => t.kind === 'sale' ? (
              <Link key={t.s.id} to={`/ventes/${t.s.id}`} className="item">
                <div className="grow"><div className="title">Achat n° {t.s.number}</div><div className="sub">{when(t.at)} · {t.s.items.length} article(s) · {PAY_LABEL[t.s.method]}</div></div>
                <div className="end"><div className="num" style={{ fontWeight: 700 }}>{money(saleNet(t.s))}</div>{saleNet(t.s) - t.s.paid > 0 && <div className="small danger-t num">crédit {money(saleNet(t.s) - t.s.paid)}</div>}</div>
              </Link>
            ) : (
              <div key={t.p.id} className="item">
                <div className="grow"><div className="title">{t.p.kind === 'reprise' ? 'Dette reprise du cahier' : t.p.amount >= 0 ? 'Paiement reçu' : 'Argent rendu'}</div><div className="sub">{when(t.at)} · {PAY_LABEL[t.p.method]}{t.p.note ? ` · ${t.p.note}` : ''}</div></div>
                <strong className={`num ${t.p.amount >= 0 ? 'ok-t' : 'danger-t'}`}>{t.p.amount >= 0 ? '−' : '+'}{money(Math.abs(t.p.amount))}</strong>
              </div>
            ))}
            {timeline.length === 0 && <div className="empty small">Aucun achat pour le moment</div>}
          </div>
        </section>
      </main>
      {paying && <PaySheet client={c} balance={balance} onClose={() => setPaying(false)} />}
      {editing && <EditClient client={c} onClose={() => setEditing(false)} />}
      {oldDebt && <OldDebtSheet client={c} onClose={() => setOldDebt(false)} />}
    </>
  );
}

function PaySheet({ client, balance, onClose }: { client: Client; balance: number; onClose: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [v, setV] = useState('');
  const [method, setMethod] = useState<'especes' | 'mtn' | 'moov'>('especes');
  const n = Number(v || 0);
  return (
    <Sheet title={`Paiement de ${client.name}`} onClose={onClose}>
      <div className="stack">
        <div className="row between"><span>Il doit</span><strong className="num">{money(balance)}</strong></div>
        <div className="seg">{(['especes', 'mtn', 'moov'] as const).map((m) => <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>{PAY_LABEL[m]}</button>)}</div>
        <div className="row-wrap"><button className="chip num" onClick={() => setV(String(balance))}>Tout : {money(balance)}</button><button className="chip num" onClick={() => setV(String(Math.round(balance / 2 / 500) * 500))}>Moitié</button></div>
        <div className="input lg num" style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '1.5rem' }}>{v ? money(n) : <span className="muted">0 F</span>}</div>
        <NumPad onKey={(k) => setV((x) => applyKey(x, k, 9))} />
        {n > balance && <div className="banner warn">C'est plus que la dette : {money(n - balance)} sera gardé en avoir.</div>}
        <button className="btn primary lg" disabled={n <= 0} onClick={async () => {
          await recordPayment({ clientId: client.id, amount: n, method, userId: user.id });
          toast({ text: `Paiement de ${money(n)} enregistré` }); onClose();
        }}>Enregistrer {n > 0 ? money(n) : ''}</button>
      </div>
    </Sheet>
  );
}

function EditClient({ client, onClose }: { client: Client; onClose: () => void }) {
  const [c, setC] = useState(client);
  return (
    <Sheet title="Modifier le client" onClose={onClose}>
      <div className="stack">
        <Field label="Nom"><input className="input lg" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input lg" inputMode="tel" value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
        <Field label="Notes"><textarea className="input" rows={2} value={c.notes ?? ''} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field>
        <button className="btn primary lg" disabled={!c.name.trim()} onClick={async () => { await db.transaction('rw', db.clients, db.outbox, () => write('clients', c)); onClose(); }}>Enregistrer</button>
      </div>
    </Sheet>
  );
}

/** Reprise d'une dette notée dans l'ancien cahier : augmente le solde sans mouvement d'argent ni de stock. */
function OldDebtSheet({ client, onClose }: { client: Client; onClose: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [v, setV] = useState('');
  const n = Number(v || 0);
  return (
    <Sheet title="Dette notée dans le cahier" onClose={onClose}>
      <div className="stack">
        <div className="small muted">À utiliser une seule fois, lors de la mise en service, pour reporter ce que {client.name} devait déjà.</div>
        <div className="input lg num" style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '1.5rem' }}>{v ? money(n) : <span className="muted">0 F</span>}</div>
        <NumPad onKey={(k) => setV((x) => applyKey(x, k, 9))} />
        <button className="btn primary lg" disabled={n <= 0} onClick={async () => {
          await recordPayment({ clientId: client.id, amount: -n, method: 'especes', userId: user.id, note: 'Reprise du cahier', kind: 'reprise' });
          toast({ text: 'Dette reportée' }); onClose();
        }}>Reporter {n > 0 ? money(n) : ''}</button>
      </div>
    </Sheet>
  );
}
