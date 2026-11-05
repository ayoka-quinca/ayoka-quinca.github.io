import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Printer, MessageCircle, Ban } from 'lucide-react';
import { db, type Company, type Quote } from '../db';
import { money, qty as fq, dateShort, enLettres, waLink } from '../domain/format';
import { setQuoteStatus } from '../domain/ops';
import { useSession, useUsers } from '../ui/hooks';
import { Confirm, TopBar } from '../ui/kit';
import { LogoMark } from '../ui/Brand';
import { useCompany } from '../ui/Ticket';
import { quoteState } from './Quotes';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Document A4 conforme aux usages béninois : en-tête, IFU / RCCM, tableau, total en lettres, cachet. */
export function QuoteDocument({ q, company, seller }: { q: Quote; company: Company; seller?: string }) {
  const vat = company.vat ? q.total - q.total / 1.18 : 0;
  return (
    <div className="doc print-doc">
      <div className="doc-wrap"><div className="doc-inner" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <LogoMark size={52} />
            <div>
              <div style={{ fontWeight: 800, letterSpacing: '.06em', fontSize: '1.1rem' }}>{company.name}</div>
              <div className="muted">Matériaux de construction et quincaillerie</div>
              <div className="muted">{company.address}</div>
              <div className="muted">Tél. {company.phone}{company.email ? ` · ${company.email}` : ''}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: '2rem', lineHeight: 1 }}>Facture proforma</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>N° {q.number}</div>
            <div className="muted">Établie le {dateShort(q.at)}</div>
            <div className="muted">Valable jusqu'au {dateShort(q.validUntil)}</div>
          </div>
        </div>
        <div style={{ background: '#f5f4f2', borderRadius: 14, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Client</div><div style={{ fontWeight: 700 }}>{q.clientName ?? '…………………………'}</div>{q.clientPhone && <div className="muted">{q.clientPhone}</div>}</div>
          {seller && <div style={{ textAlign: 'right' }}><div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Établie par</div><div style={{ fontWeight: 600 }}>{seller}</div></div>}
        </div>
        <table>
          <thead><tr><th style={{ width: 30 }}>N°</th><th>Désignation</th><th className="r">Qté</th><th>Unité</th><th className="r">Prix unitaire</th><th className="r">Montant</th></tr></thead>
          <tbody>
            {q.items.map((i, k) => (
              <tr key={k}><td className="muted">{k + 1}</td><td style={{ fontWeight: 600 }}>{i.name}</td><td className="r num">{fq(i.qty)}</td><td className="muted">{i.unit}</td><td className="r num">{money(i.unitPrice)}</td><td className="r num" style={{ fontWeight: 650 }}>{money(i.qty * i.unitPrice)}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {company.vat && <div style={{ display: 'flex', justifyContent: 'space-between' }} className="muted"><span>Total hors taxes</span><span className="num">{money(q.total - vat)}</span></div>}
            {company.vat && <div style={{ display: 'flex', justifyContent: 'space-between' }} className="muted"><span>TVA 18 %</span><span className="num">{money(vat)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #141414', paddingTop: 8, fontWeight: 800, fontSize: '1.15rem' }}><span>Total {company.vat ? 'TTC' : ''}</span><span className="num">{money(q.total, 'FCFA')}</span></div>
          </div>
        </div>
        <p style={{ lineHeight: 1.6 }}>Arrêtée la présente facture proforma à la somme de <strong>{cap(enLettres(q.total))} ({money(q.total, '')}) francs CFA</strong>.</p>
        {q.notes && <p className="muted">Remarque : {q.notes}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="muted" style={{ fontSize: '.78rem', maxWidth: 360, lineHeight: 1.5 }}>
            {company.ifu && <>IFU : {company.ifu}<br /></>}
            {company.rccm && <>RCCM : {company.rccm}<br /></>}
            Ce document est un devis. Il ne vaut pas facture définitive. Prix garantis jusqu'au {dateShort(q.validUntil)}, sous réserve du stock disponible.
          </div>
          <div style={{ textAlign: 'center', minWidth: 200 }}>
            <div className="muted" style={{ fontSize: '.8rem' }}>Signature et cachet</div>
            <div style={{ height: 70, borderBottom: '1px solid #c9c5bd', marginTop: 6 }} />
            <div style={{ fontWeight: 600, marginTop: 6, fontSize: '.85rem' }}>{company.owner}</div>
          </div>
        </div>
      </div></div>
    </div>
  );
}

export default function QuoteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useSession();
  const users = useUsers();
  const company = useCompany();
  const q = useLiveQuery(() => db.quotes.get(id!), [id]);
  const [cancel, setCancel] = useState(false);
  if (!q) return null;
  const st = quoteState(q);
  const open = q.status === 'ouvert';
  const toSale = () => {
    sessionStorage.setItem('aq.cart', JSON.stringify(q.items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice, custom: true }))));
    sessionStorage.setItem('aq.fromQuote', JSON.stringify({ id: q.id, clientId: q.clientId }));
    nav('/vendre');
  };
  const text = [
    `*${company.name}* · Facture proforma ${q.number}`,
    `Du ${dateShort(q.at)}, valable jusqu'au ${dateShort(q.validUntil)}`, '',
    ...q.items.map((i) => `• ${i.name} : ${fq(i.qty)} ${i.unit} × ${money(i.unitPrice)} = ${money(i.qty * i.unitPrice)}`), '',
    `*Total : ${money(q.total, 'FCFA')}*`, '', `${company.address} · ${company.phone}`,
  ].join('\n');
  return (
    <>
      <TopBar back="/proformas" title={`Proforma ${q.number}`} right={<span className={`badge ${st.tone}`}>{st.label}</span>} />
      <main className="main stack-lg">
        <div className="row-wrap" style={{ gap: 10 }}>
          {open && user && <button className="btn accent lg" onClick={toSale}><ShoppingCart size={20} />Le client achète</button>}
          <button className="btn lg" onClick={() => setTimeout(() => window.print(), 50)}><Printer size={20} />Imprimer (A4)</button>
          <a className="btn lg" href={waLink(q.clientPhone, text)} target="_blank" rel="noreferrer"><MessageCircle size={20} />WhatsApp</a>
          {open && <button className="btn ghost lg" onClick={() => setCancel(true)}><Ban size={18} />Annuler</button>}
        </div>
        <QuoteDocument q={q} company={company} seller={users.get(q.userId)?.name} />
      </main>
      {cancel && <Confirm title="Annuler la proforma ?" danger confirm="Oui, annuler" text="Elle restera dans l'historique, marquée « Annulée »." onClose={() => setCancel(false)} onYes={() => setQuoteStatus(q, 'annule')} />}
    </>
  );
}
