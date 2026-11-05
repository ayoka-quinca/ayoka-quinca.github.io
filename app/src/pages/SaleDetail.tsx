import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer, MessageCircle, Undo2, Ban } from 'lucide-react';
import { db } from '../db';
import { can } from '../domain/auth';
import { money, qty as fq, when, PAY_LABEL } from '../domain/format';
import { cancelSale, returnItems, saleNet } from '../domain/ops';
import { useSession, useUsers } from '../ui/hooks';
import { Confirm, Sheet, Stepper, TopBar, useToast } from '../ui/kit';
import { Ticket, shareSale, useCompany } from '../ui/Ticket';

export default function SaleDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const users = useUsers();
  const company = useCompany();
  const s = useLiveQuery(() => db.sales.get(id!), [id]);
  const client = useLiveQuery(() => (s?.clientId ? db.clients.get(s.clientId) : undefined), [s?.clientId]);
  const [ret, setRet] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [a4, setA4] = useState(false);
  if (!s) return null;
  const net = saleNet(s);
  return (
    <>
      <TopBar back title={`Vente n° ${s.number}`} />
      <main className="main stack-lg" style={{ maxWidth: 760 }}>
        {s.cancelled && <div className="banner warn"><Ban size={18} />Cette vente a été annulée, les produits sont revenus en stock.</div>}
        <div className="card stack">
          <div className="row between"><span className="muted">{when(s.at)} · par {users.get(s.userId)?.name}</span><span className="badge neutral">{PAY_LABEL[s.method]}</span></div>
          {s.clientId ? <Link to={`/clients/${s.clientId}`} className="ok-t" style={{ fontWeight: 700 }}>{s.clientName}</Link> : <span>Client de passage</span>}
          <div className="list">
            {s.items.map((i, k) => (
              <div key={k} className="item">
                <div className="grow">
                  <div className="title">{i.name}</div>
                  <div className="sub num">{fq(i.qty)} {i.unit} × {money(i.unitPrice)}{i.unitPrice !== i.listPrice && ` (catalogue ${money(i.listPrice)})`}{i.returnedQty ? ` · ${fq(i.returnedQty)} rendu(s)` : ''}</div>
                </div>
                <strong className="num">{money((i.qty - (i.returnedQty ?? 0)) * i.unitPrice)}</strong>
              </div>
            ))}
          </div>
          <div className="row between"><strong>Total</strong><span className="big num">{money(net)}</span></div>
          <div className="row between"><span>Payé à la vente</span><span className="num">{money(s.paid)}</span></div>
          {net - s.paid > 0 && <div className="row between danger-t"><strong>Laissé à crédit</strong><strong className="num">{money(net - s.paid)}</strong></div>}
        </div>
        <div className="grid-2">
          <button className="btn lg" onClick={() => { setA4(false); setTimeout(() => print(), 50); }}><Printer size={20} />Ticket</button>
          <button className="btn lg" onClick={() => { setA4(true); setTimeout(() => print(), 50); }}><Printer size={20} />Facture A4</button>
          <button className="btn lg" onClick={() => shareSale(s, company, client?.phone)}><MessageCircle size={20} />WhatsApp</button>
          {!s.cancelled && can(user, 'vendre') && <button className="btn lg" onClick={() => setRet(true)}><Undo2 size={20} />Retour d'articles</button>}
        </div>
        {!s.cancelled && can(user, 'annuler_vente') && <button className="btn ghost danger-t" onClick={() => setCancel(true)}><Ban size={18} />Annuler toute la vente</button>}
      </main>
      <Ticket sale={s} company={company} a4={a4} />
      {ret && <ReturnSheet saleId={s.id} onClose={() => setRet(false)} onDone={(refund) => toast({ text: refund > 0 ? `Retour enregistré. Rendez ${money(refund)} au client.` : 'Retour enregistré, la dette a été réduite.' })} />}
      {cancel && <Confirm title="Annuler la vente ?" danger confirm="Oui, annuler" onClose={() => setCancel(false)}
        text="Tous les articles reviennent en stock. À utiliser en cas d'erreur de saisie." onYes={() => cancelSale(s, user.id)} />}
    </>
  );
}

function ReturnSheet({ saleId, onClose, onDone }: { saleId: string; onClose: () => void; onDone: (refund: number) => void }) {
  const { user } = useSession();
  const s = useLiveQuery(() => db.sales.get(saleId), [saleId]);
  const [r, setR] = useState<Record<number, number>>({});
  if (!s) return null;
  const value = s.items.reduce((t, i, k) => t + (r[k] ?? 0) * i.unitPrice, 0);
  return (
    <Sheet title="Retour de marchandises" onClose={onClose}>
      <div className="stack">
        <div className="small muted">Indiquez combien le client rapporte. Les articles reviennent dans leur emplacement.</div>
        {s.items.map((i, k) => {
          const max = i.qty - (i.returnedQty ?? 0);
          if (max <= 0) return null;
          return (
            <div key={k} className="row between">
              <div className="grow"><div style={{ fontWeight: 700 }}>{i.name}</div><div className="small muted">Acheté : {fq(max)} {i.unit}</div></div>
              <Stepper value={r[k] ?? 0} onChange={(n) => setR({ ...r, [k]: Math.min(max, n) })} />
            </div>
          );
        })}
        <div className="row between"><strong>Valeur du retour</strong><span className="big num">{money(value)}</span></div>
        <button className="btn primary lg" disabled={value <= 0} onClick={async () => { const refund = await returnItems(s, r, user.id); onDone(refund); onClose(); }}>Valider le retour</button>
      </div>
    </Sheet>
  );
}
