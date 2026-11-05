import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Receipt } from 'lucide-react';
import { db } from '../db';
import { money, startOfDay, time, dateShort, PAY_LABEL } from '../domain/format';
import { saleNet } from '../domain/ops';
import { useUsers } from '../ui/hooks';
import { Empty, TopBar } from '../ui/kit';

/** Ventes d'une journée + clôture de caisse (ce qu'il doit y avoir dans le tiroir). */
export default function SalesPage() {
  const [day, setDay] = useState(startOfDay(Date.now()));
  const users = useUsers();
  const data = useLiveQuery(async () => {
    const [sales, pays] = await Promise.all([
      db.sales.where('at').between(day, day + 86400000).reverse().sortBy('at'),
      db.payments.where('at').between(day, day + 86400000).toArray(),
    ]);
    return { sales, pays };
  }, [day]);
  const sales = data?.sales ?? [];
  const ok = sales.filter((s) => !s.cancelled);
  const by = (m: string) => ok.filter((s) => (m === 'especes' ? s.method === 'especes' || s.method === 'credit' : s.method === m)).reduce((t, s) => t + s.paid, 0)
    + (data?.pays ?? []).filter((p) => p.method === m && !p.kind).reduce((t, p) => t + p.amount, 0);
  const credit = ok.reduce((t, s) => t + Math.max(0, saleNet(s) - s.paid), 0);
  const isToday = day === startOfDay(Date.now());
  return (
    <>
      <TopBar title={isToday ? 'Ventes du jour' : `Ventes du ${dateShort(day)}`} />
      <main className="main stack">
        <div className="row">
          <button className="btn" onClick={() => setDay(day - 86400000)}>← Veille</button>
          <input className="input grow" type="date" value={new Date(day - new Date(day).getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
            onChange={(e) => e.target.value && setDay(startOfDay(new Date(e.target.value + 'T00:00').getTime()))} />
          <button className="btn" disabled={isToday} onClick={() => setDay(day + 86400000)}>Suivant →</button>
        </div>
        <div className="card stack">
          <h2>Point de caisse</h2>
          <div className="grid-4">
            <div><div className="small muted">Espèces</div><div className="big num">{money(by('especes'))}</div></div>
            <div><div className="small muted">MTN MoMo</div><div className="big num">{money(by('mtn'))}</div></div>
            <div><div className="small muted">Moov Money</div><div className="big num">{money(by('moov'))}</div></div>
            <div><div className="small muted">Laissé à crédit</div><div className="big num danger-t">{money(credit)}</div></div>
          </div>
          <div className="small muted">Le montant « Espèces » est ce qui doit se trouver dans la caisse (ventes + remboursements de crédits reçus en espèces).</div>
        </div>
        {sales.length === 0 ? <Empty icon={Receipt} title="Aucune vente ce jour-là" /> : (
          <div className="list">
            {sales.map((s) => (
              <Link key={s.id} to={`/ventes/${s.id}`} className="item" style={s.cancelled ? { opacity: .5 } : undefined}>
                <div className="grow">
                  <div className="title">{time(s.at)} · {s.clientName ?? 'Client de passage'}</div>
                  <div className="sub">n° {s.number} · {s.items.map((i) => i.name).join(', ')}</div>
                </div>
                <div className="end">
                  <div className="num" style={{ fontWeight: 800 }}>{money(saleNet(s))}</div>
                  <div className="small muted">{s.cancelled ? 'Annulée' : PAY_LABEL[s.method]} · {users.get(s.userId)?.name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
