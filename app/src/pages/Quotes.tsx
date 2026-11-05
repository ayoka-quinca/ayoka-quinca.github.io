import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { db, type Quote } from '../db';
import { matches, money, dateShort } from '../domain/format';
import { Empty, SearchBox, TopBar } from '../ui/kit';

export function quoteState(q: Quote): { label: string; tone: string } {
  if (q.status === 'converti') return { label: 'Vendue', tone: 'ok' };
  if (q.status === 'annule') return { label: 'Annulée', tone: 'neutral' };
  const days = Math.ceil((q.validUntil - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expirée', tone: 'danger' };
  return { label: days === 0 ? "Expire aujourd'hui" : `Valable ${days} j`, tone: days <= 3 ? 'warn' : 'info' };
}

export default function QuotesPage() {
  const nav = useNavigate();
  const quotes = useLiveQuery(() => db.quotes.orderBy('at').reverse().toArray(), []) ?? [];
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const list = quotes.filter((x) => (tab === 'all' || (x.status === 'ouvert' && x.validUntil >= Date.now())) && matches(`${x.number} ${x.clientName ?? ''} ${x.items.map((i) => i.name).join(' ')}`, q));
  return (
    <>
      <TopBar title="Proformas" right={<button className="btn primary" onClick={() => nav('/vendre')}><Plus size={18} />Nouvelle</button>} />
      <main className="main stack-lg">
        <p className="soft-t" style={{ maxWidth: 620 }}>Un devis chiffré pour le client ou le chantier. Il ne touche ni au stock ni à la caisse : quand le client revient, on le transforme en vente en un geste.</p>
        <div className="stack">
          <div className="seg" style={{ maxWidth: 420 }}>
            <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>En cours</button>
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Toutes</button>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Client, numéro, produit…" />
        </div>
        {list.length === 0 ? (
          <Empty icon={FileText} title="Aucune proforma" text="Dans l'écran Vendre, remplissez le panier puis touchez « Proforma »." />
        ) : (
          <div className="list">
            {list.map((x) => {
              const st = quoteState(x);
              return (
                <Link key={x.id} to={`/proformas/${x.id}`} className="item">
                  <span className="glyph"><FileText size={20} /></span>
                  <div className="grow"><div className="title">{x.clientName ?? 'Client non précisé'}</div><div className="sub">{x.number} · {dateShort(x.at)} · {x.items.length} article(s)</div></div>
                  <div className="end stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <strong className="num">{money(x.total)}</strong>
                    <span className={`badge ${st.tone}`}>{st.label}</span>
                  </div>
                  <ChevronRight size={18} className="chev hide-m" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
