import { NavLink } from 'react-router-dom';
import { Lock, Type } from 'lucide-react';
import { NAV } from '../App';
import { can, audit, ROLE_LABEL } from '../domain/auth';
import { useSession } from '../ui/hooks';
import { Avatar, TopBar } from '../ui/kit';
import { useState } from 'react';

export function TextSize() {
  const [size, setSize] = useState(localStorage.getItem('aq.size') ?? 'm');
  const pick = (s: string) => { setSize(s); localStorage.setItem('aq.size', s); document.documentElement.dataset.size = s; };
  return (
    <div className="card stack">
      <div className="row"><Type size={20} /><h3>Taille du texte</h3></div>
      <div className="seg">
        <button className={size === 'm' ? 'on' : ''} onClick={() => pick('m')} style={{ fontSize: 16 }}>A</button>
        <button className={size === 'l' ? 'on' : ''} onClick={() => pick('l')} style={{ fontSize: 19 }}>A+</button>
        <button className={size === 'xl' ? 'on' : ''} onClick={() => pick('xl')} style={{ fontSize: 22 }}>A++</button>
      </div>
    </div>
  );
}

export default function MorePage() {
  const { user, lock } = useSession();
  return (
    <>
      <TopBar title="Plus" />
      <main className="main stack-lg">
        <div className="card row">
          <Avatar name={user.name} color={user.color} />
          <div className="grow"><div style={{ fontWeight: 700 }}>{user.name}</div><div className="small muted">{ROLE_LABEL[user.role]}</div></div>
          <button className="btn" onClick={() => { audit(user.id, 'Déconnexion'); lock(); }}><Lock size={18} />Verrouiller</button>
        </div>
        <div className="list">
          {NAV.filter((n) => n.to !== '/' && (!n.perm || can(user, n.perm))).map((n) => (
            <NavLink key={n.to} to={n.to} className="item"><n.icon size={24} /><span className="title grow">{n.label}</span></NavLink>
          ))}
        </div>
        <TextSize />
      </main>
    </>
  );
}
