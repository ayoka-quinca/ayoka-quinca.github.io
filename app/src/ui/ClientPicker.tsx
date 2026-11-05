import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { db, write, uid, type Client } from '../db';
import { matches, money } from '../domain/format';
import { useBalances, useClients } from './hooks';
import { Field, SearchBox, Sheet } from './kit';

export function ClientPicker({ onPick, onClose }: { onPick: (c: Client) => void; onClose: () => void }) {
  const clients = useClients();
  const balances = useBalances();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const list = clients.filter((c) => matches(`${c.name} ${c.phone ?? ''}`, q)).slice(0, 30);

  const create = async () => {
    const c: Client = { id: uid(), name: name.trim(), phone: phone.trim() || undefined, createdAt: Date.now(), updatedAt: 0 };
    await db.transaction('rw', db.clients, db.outbox, () => write('clients', c));
    onPick(c);
  };

  return (
    <Sheet title={creating ? 'Nouveau client' : 'Choisir le client'} onClose={onClose}>
      {creating ? (
        <div className="stack">
          <Field label="Nom du client"><input className="input lg" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Téléphone (pour WhatsApp)"><input className="input lg num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 96 00 00 00" /></Field>
          <button className="btn primary lg" disabled={!name.trim()} onClick={create}>Enregistrer le client</button>
          <button className="btn ghost" onClick={() => setCreating(false)}>Retour à la liste</button>
        </div>
      ) : (
        <div className="stack">
          <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone…" autoFocus />
          <button className="btn soft lg" onClick={() => { setCreating(true); setName(q); }}><UserPlus size={20} />Nouveau client</button>
          <div className="list">
            {list.map((c) => {
              const b = balances.get(c.id) ?? 0;
              return (
                <button key={c.id} className="item" onClick={() => onPick(c)}>
                  <div className="grow"><div className="title">{c.name}</div><div className="sub">{c.phone}</div></div>
                  {b > 0 && <span className="badge danger num">doit {money(b)}</span>}
                </button>
              );
            })}
            {list.length === 0 && <div className="empty small">Aucun client trouvé</div>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
