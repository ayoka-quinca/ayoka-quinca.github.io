import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { matches, money } from '../domain/format';
import { useBalances, useClients } from '../ui/hooks';
import { Empty, SearchBox, TopBar } from '../ui/kit';
import { ClientPicker } from '../ui/ClientPicker';

export default function ClientsPage() {
  const clients = useClients();
  const balances = useBalances();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'dette' | 'tous'>('dette');
  const [adding, setAdding] = useState(false);
  const owed = [...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const list = clients
    .filter((c) => (tab === 'tous' || (balances.get(c.id) ?? 0) > 0) && matches(`${c.name} ${c.phone ?? ''}`, q))
    .sort((a, b) => (tab === 'dette' ? (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0) : a.name.localeCompare(b.name)));
  return (
    <>
      <TopBar title="Clients & crédits" right={<button className="btn primary" onClick={() => setAdding(true)}><UserPlus size={20} />Client</button>} />
      <main className="main stack">
        <div className="card tint-danger row between">
          <div><div className="small" style={{ fontWeight: 600 }}>Total que les clients me doivent</div><div className="big num">{money(owed)}</div></div>
        </div>
        <div className="seg">
          <button className={tab === 'dette' ? 'on' : ''} onClick={() => setTab('dette')}>Me doivent de l'argent</button>
          <button className={tab === 'tous' ? 'on' : ''} onClick={() => setTab('tous')}>Tous les clients</button>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone…" />
        {list.length === 0 ? (
          <Empty icon={Users} title={tab === 'dette' ? 'Aucun crédit en cours' : 'Aucun client'} />
        ) : (
          <div className="list">
            {list.map((c) => {
              const b = balances.get(c.id) ?? 0;
              return (
                <Link key={c.id} to={`/clients/${c.id}`} className="item">
                  <div className="grow"><div className="title">{c.name}</div><div className="sub">{c.phone ?? 'Pas de téléphone'}</div></div>
                  <div className="end">
                    {b > 0 ? <strong className="danger-t num">{money(b)}</strong> : b < 0 ? <span className="badge info num">avoir {money(-b)}</span> : <span className="badge ok">À jour</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      {adding && <ClientPicker onClose={() => setAdding(false)} onPick={(c) => nav(`/clients/${c.id}`)} />}
    </>
  );
}
