import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home, Package, ShoppingCart, Users, Menu, Map as MapIcon, Truck, ClipboardCheck, BarChart3, Settings,
  Receipt, Lock, Store, WifiOff, Factory,
} from 'lucide-react';
import { db, type User } from './db';
import { can, checkPin, audit, ROLE_LABEL, type Perm } from './domain/auth';
import { seedDemo, seedStructure, createOwner } from './domain/seed';
import { onSync, startSyncLoop, syncNow, type SyncState } from './domain/sync';
import { setSetting } from './db';
import { SessionCtx, useSession } from './ui/hooks';
import { ToastProvider, NumPad, applyKey, Avatar, Field } from './ui/kit';
import HomePage from './pages/Home';
import SellPage from './pages/Sell';

const ProductsPage = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const PlanPage = lazy(() => import('./pages/Plan'));
const ClientsPage = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const SalesPage = lazy(() => import('./pages/Sales'));
const SaleDetail = lazy(() => import('./pages/SaleDetail'));
const PurchasesPage = lazy(() => import('./pages/Purchases'));
const PurchaseForm = lazy(() => import('./pages/PurchaseForm'));
const SuppliersPage = lazy(() => import('./pages/Suppliers'));
const InventoryPage = lazy(() => import('./pages/Inventory'));
const InventoryCount = lazy(() => import('./pages/InventoryCount'));
const ReportsPage = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const MorePage = lazy(() => import('./pages/More'));

export const NAV: { to: string; label: string; icon: typeof Home; perm?: Perm }[] = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/vendre', label: 'Vendre', icon: ShoppingCart, perm: 'vendre' },
  { to: '/ventes', label: 'Ventes du jour', icon: Receipt },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/plan', label: 'Plan du magasin', icon: MapIcon },
  { to: '/clients', label: 'Clients & crédits', icon: Users, perm: 'clients' },
  { to: '/achats', label: 'Achats', icon: Truck, perm: 'achats' },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Factory, perm: 'achats' },
  { to: '/inventaire', label: 'Inventaire', icon: ClipboardCheck, perm: 'inventaire' },
  { to: '/rapports', label: 'Rapports', icon: BarChart3, perm: 'rapports' },
  { to: '/parametres', label: 'Paramètres', icon: Settings, perm: 'parametres' },
];

const ROLE_ORDER = { responsable: 0, caissiere: 1, employe: 2 } as const;

export default function App() {
  const users = useLiveQuery(() => db.users.toArray(), []);
  const [uid, setUid] = useState<string | null>(() => localStorage.getItem('aq.session'));
  useEffect(() => {
    const size = localStorage.getItem('aq.size');
    if (size) document.documentElement.dataset.size = size;
    startSyncLoop();
  }, []);
  if (!users) return null;
  if (users.length === 0) return <Onboarding />;
  const user = users.find((u) => u.id === uid && u.active);
  const lock = () => { localStorage.removeItem('aq.session'); setUid(null); };
  if (!user) return <Login users={users.filter((u) => u.active).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))} onIn={(u) => { localStorage.setItem('aq.session', u.id); setUid(u.id); }} />;
  return (
    <SessionCtx.Provider value={{ user, lock }}>
      <ToastProvider>
        <BrowserRouter>
          <Shell>
            <Suspense fallback={<div className="empty">Chargement…</div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/vendre" element={<Guard perm="vendre"><SellPage /></Guard>} />
                <Route path="/ventes" element={<SalesPage />} />
                <Route path="/ventes/:id" element={<SaleDetail />} />
                <Route path="/stock" element={<ProductsPage />} />
                <Route path="/stock/nouveau" element={<Guard perm="modifier_produits"><ProductForm /></Guard>} />
                <Route path="/stock/:id" element={<ProductDetail />} />
                <Route path="/stock/:id/modifier" element={<Guard perm="modifier_produits"><ProductForm /></Guard>} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/clients" element={<Guard perm="clients"><ClientsPage /></Guard>} />
                <Route path="/clients/:id" element={<Guard perm="clients"><ClientDetail /></Guard>} />
                <Route path="/achats" element={<Guard perm="achats"><PurchasesPage /></Guard>} />
                <Route path="/achats/nouveau" element={<Guard perm="achats"><PurchaseForm /></Guard>} />
                <Route path="/fournisseurs" element={<Guard perm="achats"><SuppliersPage /></Guard>} />
                <Route path="/inventaire" element={<Guard perm="inventaire"><InventoryPage /></Guard>} />
                <Route path="/inventaire/:id" element={<Guard perm="inventaire"><InventoryCount /></Guard>} />
                <Route path="/rapports" element={<Guard perm="rapports"><ReportsPage /></Guard>} />
                <Route path="/parametres" element={<Guard perm="parametres"><SettingsPage /></Guard>} />
                <Route path="/plus" element={<MorePage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </Shell>
        </BrowserRouter>
      </ToastProvider>
    </SessionCtx.Provider>
  );
}

function Guard({ perm, children }: { perm: Perm; children: ReactNode }) {
  const { user } = useSession();
  if (!can(user, perm)) return <div className="main"><div className="card">Cette page est réservée à la responsable.</div></div>;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, lock } = useSession();
  const [sync, setSync] = useState<SyncState>({ status: 'off', pending: 0 });
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => onSync(setSync) as () => void, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const items = NAV.filter((n) => !n.perm || can(user, n.perm));
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Menu principal">
        <div className="brandmark"><span className="logo"><Store size={20} color="#fff" /></span>AYOKA QUINCA</div>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={22} />{n.label}</NavLink>
        ))}
        <div className="grow" />
        <SyncPill sync={sync} online={online} />
        <div className="sep" />
        <div className="row" style={{ padding: '4px 8px' }}>
          <Avatar name={user.name} color={user.color} />
          <div className="grow"><div style={{ fontWeight: 700 }}>{user.name}</div><div className="small muted">{ROLE_LABEL[user.role]}</div></div>
          <button className="iconbtn" onClick={() => { audit(user.id, 'Déconnexion'); lock(); }} aria-label="Verrouiller" title="Verrouiller"><Lock size={20} /></button>
        </div>
      </nav>
      <div>
        {!online && (
          <div className="banner warn hide-d" style={{ borderRadius: 0 }}>
            <WifiOff size={18} /> Pas d'Internet — tout continue de marcher, les données partiront plus tard.
          </div>
        )}
        {children}
      </div>
      <nav className="bottomnav" aria-label="Navigation">
        <NavLink to="/" end><Home size={24} />Accueil</NavLink>
        <NavLink to="/stock"><Package size={24} />Stock</NavLink>
        {can(user, 'vendre') ? (
          <NavLink to="/vendre" aria-label="Vendre"><span className="sell-fab"><ShoppingCart size={28} /></span>Vendre</NavLink>
        ) : (
          <NavLink to="/plan"><MapIcon size={24} />Plan</NavLink>
        )}
        {can(user, 'clients') ? <NavLink to="/clients"><Users size={24} />Clients</NavLink> : <NavLink to="/inventaire"><ClipboardCheck size={24} />Inventaire</NavLink>}
        <NavLink to="/plus"><Menu size={24} />Plus</NavLink>
      </nav>
    </div>
  );
}

export function SyncPill({ sync, online }: { sync: SyncState; online: boolean }) {
  const label = !online ? 'Hors ligne' : sync.status === 'off' ? 'Données sur cet appareil' : sync.status === 'syncing' ? 'Synchronisation…' : sync.status === 'error' ? 'Synchro en échec' : 'À jour';
  const cls = !online || sync.status === 'error' ? 'warn' : sync.status === 'off' ? 'neutral' : 'ok';
  return (
    <div style={{ padding: '0 8px' }}>
      <span className={`badge ${cls}`}>{label}{sync.pending > 0 && sync.status !== 'off' ? ` · ${sync.pending} en attente` : ''}</span>
    </div>
  );
}

/* ------------------------------ Connexion par code PIN ------------------------------ */
function Login({ users, onIn }: { users: User[]; onIn: (u: User) => void }) {
  const [sel, setSel] = useState<User | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const demo = useLiveQuery(() => db.settings.get('demo'), []);
  const tryPin = async (p: string) => {
    if (!sel || p.length < 4) return;
    if (await checkPin(sel, p)) { await audit(sel.id, 'Connexion'); onIn(sel); }
    else { setBad(true); setPin(''); setTimeout(() => setBad(false), 400); }
  };
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="stack-lg" style={{ width: 'min(420px, 100%)' }}>
        <div className="brandmark" style={{ justifyContent: 'center', fontSize: '1.2rem' }}><span className="logo"><Store size={20} color="#fff" /></span>AYOKA QUINCA</div>
        {!sel ? (
          <div className="stack">
            <h1 style={{ textAlign: 'center' }}>Qui êtes-vous ?</h1>
            <div className="list">
              {users.map((u) => (
                <button key={u.id} className="item" onClick={() => setSel(u)}>
                  <Avatar name={u.name} color={u.color} />
                  <div className="grow"><div className="title">{u.name}</div><div className="sub">{ROLE_LABEL[u.role]}</div></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="stack" style={{ alignItems: 'center' }}>
            <Avatar name={sel.name} color={sel.color} lg />
            <h1>Bonjour {sel.name}</h1>
            <div className="muted">Tapez votre code secret</div>
            <div className={`pin-dots ${bad ? 'shake' : ''}`}>{[0, 1, 2, 3].map((i) => <span key={i} className={pin.length > i ? 'on' : ''} />)}</div>
            {bad && <div className="danger-t" style={{ fontWeight: 700 }}>Code incorrect, réessayez</div>}
            <div style={{ width: '100%' }}>
              <NumPad onKey={(k) => { const n = applyKey(pin, k, 4); setPin(n); if (n.length === 4) tryPin(n); }} />
            </div>
            {users.length > 1 && <button className="btn ghost" onClick={() => { setSel(null); setPin(''); }}>Ce n'est pas moi</button>}
          </div>
        )}
        {demo?.value === true && <div className="banner info">Démonstration — codes : Sofiatou 1234 · Caissière 2222 · Vendeur 3333</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Premier démarrage ------------------------------ */
function Onboarding() {
  const [step, setStep] = useState<'choice' | 'owner' | 'join'>('choice');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="stack-lg" style={{ width: 'min(460px, 100%)' }}>
        <div className="brandmark" style={{ justifyContent: 'center', fontSize: '1.2rem' }}><span className="logo"><Store size={20} color="#fff" /></span>AYOKA QUINCA</div>
        {step === 'choice' ? (
          <div className="stack">
            <h1 style={{ textAlign: 'center' }}>Bienvenue</h1>
            <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Ventes, stock et crédits de la boutique, même sans Internet.</p>
            <button className="action-tile main" disabled={busy} onClick={() => setStep('owner')}>
              <span className="ic"><Store size={24} /></span>
              <span>Commencer avec ma boutique<br /><span className="small" style={{ fontWeight: 500, opacity: .9 }}>Je crée mon compte et j'ajoute mes produits</span></span>
            </button>
            <button className="action-tile" disabled={busy} onClick={async () => { setBusy(true); await seedDemo(); }}>
              <span className="ic"><Package size={24} /></span>
              <span>Essayer avec des exemples<br /><span className="small muted" style={{ fontWeight: 500 }}>Produits et ventes fictifs, pour découvrir</span></span>
            </button>
            <button className="btn ghost lg" disabled={busy} onClick={() => setStep('join')}>Cet appareil rejoint une boutique déjà installée</button>
          </div>
        ) : step === 'join' ? (
          <div className="stack">
            <h1>Rejoindre la boutique</h1>
            <p className="muted" style={{ margin: 0 }}>Demandez l'adresse et la clé à la responsable (Paramètres › Synchronisation).</p>
            <Field label="Adresse du serveur"><input className="input lg" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://…" /></Field>
            <Field label="Clé de la boutique"><input className="input lg" type="password" value={token} onChange={(e) => setToken(e.target.value.trim())} /></Field>
            {err && <div className="banner warn">{err}</div>}
            <button className="btn primary lg" disabled={!url || !token || busy} onClick={async () => {
              setBusy(true); setErr('');
              await setSetting('sync', { url, token });
              await syncNow();
              if (!(await db.users.count())) { setErr("Impossible de récupérer les données. Vérifiez l'adresse, la clé et la connexion Internet."); setBusy(false); }
            }}>{busy ? 'Récupération des données…' : 'Se connecter'}</button>
            <button className="btn ghost" onClick={() => setStep('choice')}>Retour</button>
          </div>
        ) : (
          <div className="stack">
            <h1>Votre compte responsable</h1>
            <Field label="Votre prénom"><input className="input lg" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label="Choisissez un code secret (4 chiffres)" hint="Il sert à ouvrir l'application. Ne le donnez à personne.">
              <input className="input lg num" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} type="password" />
            </Field>
            <button className="btn primary lg" disabled={!name.trim() || pin.length !== 4 || busy}
              onClick={async () => { setBusy(true); await seedStructure(); const u = await createOwner(name.trim(), pin); localStorage.setItem('aq.session', u.id); location.reload(); }}>
              Créer et entrer
            </button>
            <button className="btn ghost" onClick={() => setStep('choice')}>Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}
