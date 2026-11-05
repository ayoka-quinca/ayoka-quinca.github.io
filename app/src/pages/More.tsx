import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import { NAV_GROUPS } from '../App';
import { can, audit, ROLE_LABEL } from '../domain/auth';
import { useSession } from '../ui/hooks';
import { TopBar } from '../ui/kit';
import { Avatar } from '../ui/Brand';

export function TextSize() {
  const [size, setSize] = useState(() => { try { return localStorage.getItem('aq.size') ?? 'm'; } catch { return 'm'; } });
  const pick = (s: string) => { setSize(s); try { localStorage.setItem('aq.size', s); } catch { /* rien */ } document.documentElement.dataset.size = s; };
  return (
    <div className="card stack">
      <div><h3>Taille du texte</h3><div className="small muted">Agrandissez si vous lisez mieux de plus gros caractères.</div></div>
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
          <button className="btn sm" onClick={() => { audit(user.id, 'logout'); lock(); }}><Lock size={16} />Verrouiller</button>
        </div>
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((n) => n.to !== '/' && (!n.perm || can(user, n.perm)));
          if (!items.length) return null;
          return (
            <section key={g.label} className="stack" style={{ gap: 10 }}>
              <span className="eyebrow" style={{ paddingLeft: 4 }}>{g.label}</span>
              <div className="list">
                {items.map((n) => (
                  <NavLink key={n.to} to={n.to} className="item">
                    <span className="glyph sm"><n.icon size={18} /></span>
                    <span className="title grow">{n.label}</span>
                    <ChevronRight size={18} className="chev" />
                  </NavLink>
                ))}
              </div>
            </section>
          );
        })}
        <TextSize />
      </main>
    </>
  );
}
