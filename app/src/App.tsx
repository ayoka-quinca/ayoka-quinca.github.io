import { lazy, Suspense, useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { BrowserRouter, MemoryRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home, Package, ShoppingCart, Users, Menu, Map as MapIcon, Truck, ClipboardCheck, BarChart3, Settings,
  Receipt, Lock, WifiOff, Factory, FileText, History, ArrowRight, MapPin, HandCoins, CloudOff, ChevronLeft, CheckCircle2,
} from 'lucide-react';
import { db, setActor, setSetting, type Location, type User } from './db';
import { can, checkPin, audit, ROLE_LABEL, type Perm } from './domain/auth';
import { seedDemo, seedStructure, createOwner, PLAN_ZONES } from './domain/seed';
import { onSync, startSyncLoop, syncNow, type SyncState } from './domain/sync';
import { money } from './domain/format';
import { SessionCtx, useSession } from './ui/hooks';
import { ToastProvider, NumPad, applyKey, Field, ErrorBoundary } from './ui/kit';
import { Avatar, Logo, LogoMark, Splash } from './ui/Brand';
import { StoreMap } from './ui/StoreMap';
import HomePage from './pages/Home';
import SellPage from './pages/Sell';

// Version « lien de test » : pas d'URL par écran, la navigation reste interne.
const Router = import.meta.env.VITE_ARTIFACT === '1' ? MemoryRouter : BrowserRouter;

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
const JournalPage = lazy(() => import('./pages/Journal'));
const QuotesPage = lazy(() => import('./pages/Quotes'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));

type NavItem = { to: string; label: string; icon: typeof Home; perm?: Perm };
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Au quotidien',
    items: [
      { to: '/', label: 'Accueil', icon: Home },
      { to: '/ventes', label: 'Ventes', icon: Receipt },
      { to: '/proformas', label: 'Proformas', icon: FileText, perm: 'vendre' },
      { to: '/clients', label: 'Clients & crédits', icon: Users, perm: 'clients' },
    ],
  },
  {
    label: 'Magasin',
    items: [
      { to: '/stock', label: 'Stock', icon: Package },
      { to: '/plan', label: 'Plan du magasin', icon: MapIcon },
      { to: '/inventaire', label: 'Inventaire', icon: ClipboardCheck, perm: 'inventaire' },
      { to: '/achats', label: 'Achats', icon: Truck, perm: 'achats' },
      { to: '/fournisseurs', label: 'Fournisseurs', icon: Factory, perm: 'achats' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { to: '/rapports', label: 'Rapports', icon: BarChart3, perm: 'rapports' },
      { to: '/journal', label: "Journal d'activité", icon: History, perm: 'rapports' },
      { to: '/parametres', label: 'Paramètres', icon: Settings, perm: 'parametres' },
    ],
  },
];
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const ROLE_ORDER = { responsable: 0, caissiere: 1, employe: 2 } as const;

export default function App() {
  // L'écran de chargement s'affiche en entier une fois par session, puis s'efface dès que les données sont prêtes.
  const [minDone, setMinDone] = useState(() => { try { return sessionStorage.getItem('aq.splash') === '1'; } catch { return false; } });
  useEffect(() => {
    if (minDone) return;
    const t = setTimeout(() => { setMinDone(true); try { sessionStorage.setItem('aq.splash', '1'); } catch { /* rien */ } }, 2000);
    return () => clearTimeout(t);
  }, [minDone]);
  const users = useLiveQuery(() => db.users.toArray(), []);
  return (
    <>
      {users && <Main users={users} />}
      <Splash out={!!users && minDone} />
    </>
  );
}

function Main({ users }: { users: User[] }) {
  const [uid, setUid] = useState<string | null>(() => localStorage.getItem('aq.session'));
  useEffect(() => {
    const size = localStorage.getItem('aq.size');
    if (size) document.documentElement.dataset.size = size;
    startSyncLoop();
  }, []);
  if (users.length === 0) return <Welcome />;
  const user = users.find((u) => u.id === uid && u.active);
  const lock = () => { localStorage.removeItem('aq.session'); setUid(null); };
  if (!user) {
    const active = users.filter((u) => u.active).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
    return <Login users={active} onIn={(u) => { localStorage.setItem('aq.session', u.id); setUid(u.id); }} />;
  }
  setActor(user.id);
  return (
    <SessionCtx.Provider value={{ user, lock }}>
      <ToastProvider>
        <Router>
          <Shell>
            <ErrorBoundary><Suspense fallback={<div className="empty">Chargement…</div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/vendre" element={<Guard perm="vendre"><SellPage /></Guard>} />
                <Route path="/ventes" element={<SalesPage />} />
                <Route path="/ventes/:id" element={<SaleDetail />} />
                <Route path="/proformas" element={<Guard perm="vendre"><QuotesPage /></Guard>} />
                <Route path="/proformas/:id" element={<Guard perm="vendre"><QuoteDetail /></Guard>} />
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
                <Route path="/journal" element={<Guard perm="rapports"><JournalPage /></Guard>} />
                <Route path="/parametres" element={<Guard perm="parametres"><SettingsPage /></Guard>} />
                <Route path="/plus" element={<MorePage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense></ErrorBoundary>
          </Shell>
        </Router>
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
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Menu principal">
        <div className="brand"><Logo size={38} sub={false} /></div>
        {can(user, 'vendre') && <NavLink to="/vendre" className="sell-cta"><ShoppingCart size={20} />Nouvelle vente</NavLink>}
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((n) => !n.perm || can(user, n.perm));
          if (!items.length) return null;
          return (
            <div key={g.label} className="navgroup">
              <div className="navlabel eyebrow">{g.label}</div>
              {items.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}><n.icon size={20} />{n.label}</NavLink>)}
            </div>
          );
        })}
        <div className="grow" />
        <SyncPill sync={sync} online={online} />
        <div className="me" style={{ marginTop: 10 }}>
          <Avatar name={user.name} color={user.color} />
          <div className="grow"><div style={{ fontWeight: 700 }}>{user.name}</div><div className="tiny muted">{ROLE_LABEL[user.role]}</div></div>
          <button className="iconbtn" onClick={() => { audit(user.id, 'logout'); lock(); }} aria-label="Verrouiller" title="Verrouiller"><Lock size={18} /></button>
        </div>
      </nav>
      <div>
        {!online && <div className="banner warn offline hide-d"><WifiOff size={16} />Hors ligne · vos ventes sont gardées et partiront plus tard</div>}
        {children}
      </div>
      <nav className="bottomnav" aria-label="Navigation">
        <NavLink to="/" end><Home size={22} />Accueil</NavLink>
        <NavLink to="/stock"><Package size={22} />Stock</NavLink>
        {can(user, 'vendre') ? <NavLink to="/vendre" className="sell"><ShoppingCart size={22} />Vendre</NavLink> : <NavLink to="/plan"><MapIcon size={22} />Plan</NavLink>}
        {can(user, 'clients') ? <NavLink to="/clients"><Users size={22} />Clients</NavLink> : <NavLink to="/inventaire"><ClipboardCheck size={22} />Inventaire</NavLink>}
        <NavLink to="/plus"><Menu size={22} />Plus</NavLink>
      </nav>
    </div>
  );
}

export function SyncPill({ sync, online }: { sync: SyncState; online: boolean }) {
  const label = !online ? 'Hors ligne' : sync.status === 'off' ? 'Enregistré sur cet appareil' : sync.status === 'syncing' ? 'Synchronisation…' : sync.status === 'error' ? 'Synchro en échec' : 'Tout est à jour';
  const color = !online || sync.status === 'error' ? 'var(--warn)' : sync.status === 'off' ? 'var(--ink-3)' : 'var(--ok)';
  return (
    <div className="row tiny" style={{ padding: '0 12px', gap: 8, color: 'var(--ink-3)', fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {label}{sync.pending > 0 && sync.status !== 'off' ? ` · ${sync.pending} en attente` : ''}
    </div>
  );
}

/* ------------------------------ Connexion ------------------------------ */
function Login({ users, onIn }: { users: User[]; onIn: (u: User) => void }) {
  const [sel, setSel] = useState<User | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const demo = useLiveQuery(() => db.settings.get('demo'), []);
  const tryPin = async (p: string) => {
    if (!sel || p.length < 4) return;
    if (await checkPin(sel, p)) { await audit(sel.id, 'login'); onIn(sel); }
    else { setBad(true); setPin(''); setTimeout(() => setBad(false), 400); }
  };
  const hour = new Date().getHours();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px max(20px, env(safe-area-inset-right, 0px)) 24px max(20px, env(safe-area-inset-left, 0px))' }}>
      <div className="stack-lg" style={{ width: 'min(440px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo size={44} /></div>
        {!sel ? (
          <div className="stack-lg" style={{ animation: 'rise .4s var(--ease)' }}>
            <div style={{ textAlign: 'center' }} className="stack">
              <h1 className="display" style={{ fontSize: '2.6rem' }}>{hour < 13 ? 'Bonjour' : 'Bonsoir'}.<br /><em>Qui travaille ?</em></h1>
            </div>
            <div className="grid-2" style={users.length > 2 ? { gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' } : undefined}>
              {users.map((u) => (
                <button key={u.id} className="card stack" style={{ alignItems: 'center', padding: '22px 12px', textAlign: 'center', cursor: 'pointer' }} onClick={() => setSel(u)}>
                  <Avatar name={u.name} color={u.color} size="lg" />
                  <div><div style={{ fontWeight: 700 }}>{u.name}</div><div className="tiny muted">{ROLE_LABEL[u.role]}</div></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="stack" style={{ alignItems: 'center', animation: 'rise .35s var(--ease)' }}>
            <Avatar name={sel.name} color={sel.color} size="lg" />
            <h1>{sel.name}</h1>
            <div className="muted">Tapez votre code secret</div>
            <div className={`pin-dots ${bad ? 'shake' : ''}`}>{[0, 1, 2, 3].map((i) => <span key={i} className={pin.length > i ? 'on' : ''} />)}</div>
            {bad && <div className="danger-t small" style={{ fontWeight: 700, marginTop: -10 }}>Ce n'est pas le bon code</div>}
            <div style={{ width: '100%' }}><NumPad onKey={(k) => { const n = applyKey(pin, k, 4); setPin(n); if (n.length === 4) tryPin(n); }} /></div>
            {users.length > 1 && <button className="btn ghost" onClick={() => { setSel(null); setPin(''); }}><ChevronLeft size={18} />Changer de personne</button>}
          </div>
        )}
        {demo?.value === true && <div className="banner info" style={{ justifyContent: 'center' }}>Démonstration · codes : Sofiatou 1234 · Caissière 2222 · Vendeur 3333</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Bienvenue (premier lancement) ------------------------------ */
const PREVIEW_ZONES: Location[] = PLAN_ZONES.map((z, i) => ({ ...z, id: 'z' + i, updatedAt: 0 }));

function Welcome() {
  const [step, setStep] = useState<'intro' | 'owner' | 'join'>('intro');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const darkVars = { '--map-bg': '#141414', '--surface': '#141414', '--ink': '#f4f4f5', '--ink-3': '#9a9aa0', '--accent-ink': '#ff9a6b' } as CSSProperties;
  return (
    <div className="welcome">
      <div className="pane">
        <Logo size={44} />
        {step === 'intro' && (
          <>
            <div className="stack" style={{ gap: 18, animation: 'rise .5s var(--ease)' }}>
              <h1 className="display hero-title">Fini les cahiers.<br /><em>Votre boutique</em>, en un coup d'œil.</h1>
              <p className="soft-t" style={{ fontSize: '1.08rem', maxWidth: 440 }}>Ventes, stock et crédits au même endroit, sur le téléphone comme sur l'ordinateur. Même quand Internet coupe.</p>
            </div>
            <div className="stack" style={{ gap: 18 }}>
              {[
                { icon: ShoppingCart, t: 'Vendre en deux gestes', s: 'Le produit, la quantité. Le total et la monnaie se calculent seuls.' },
                { icon: MapPin, t: 'Savoir où est chaque produit', s: 'Du hall à l’arrière-cour, chaque zone a sa couleur.' },
                { icon: HandCoins, t: 'Suivre qui vous doit quoi', s: 'Crédits, avances et rappels polis par WhatsApp.' },
                { icon: CloudOff, t: 'Rien ne se perd', s: 'Tout est gardé dans l’appareil puis envoyé dès que le réseau revient.' },
              ].map((f) => (
                <div key={f.t} className="feature">
                  <span className="glyph"><f.icon size={21} /></span>
                  <div><div style={{ fontWeight: 700 }}>{f.t}</div><div className="small muted">{f.s}</div></div>
                </div>
              ))}
            </div>
            <div className="stack">
              <button className="btn accent lg block" disabled={busy} onClick={() => setStep('owner')}>Commencer avec ma boutique<ArrowRight size={20} /></button>
              <button className="btn lg block" disabled={busy} onClick={async () => { setBusy(true); await seedDemo(); }}>{busy ? 'Préparation des exemples…' : 'Découvrir avec des exemples'}</button>
              <button className="btn ghost" disabled={busy} onClick={() => setStep('join')}>Cet appareil rejoint une boutique déjà installée</button>
            </div>
          </>
        )}
        {step === 'owner' && (
          <div className="stack-lg" style={{ animation: 'rise .35s var(--ease)' }}>
            <div className="stack">
              <span className="eyebrow">Étape 1 sur 1</span>
              <h1 className="display" style={{ fontSize: '2.6rem' }}>Votre compte <em>responsable</em></h1>
              <p className="soft-t">Les zones du magasin et les catégories sont déjà prêtes. Vous ajouterez l'équipe et les produits ensuite.</p>
            </div>
            <Field label="Votre prénom"><input id="owner-name" className="input lg" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label="Votre code secret (4 chiffres)" hint="Il sert à ouvrir l'application. Ne le donnez à personne.">
              <input id="owner-pin" className="input lg num" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} type="password" />
            </Field>
            <button className="btn accent lg block" disabled={!name.trim() || pin.length !== 4 || busy}
              onClick={async () => { setBusy(true); await seedStructure(); const u = await createOwner(name.trim(), pin); localStorage.setItem('aq.session', u.id); location.reload(); }}>
              Créer et entrer<ArrowRight size={20} />
            </button>
            <button className="btn ghost" onClick={() => setStep('intro')}><ChevronLeft size={18} />Retour</button>
          </div>
        )}
        {step === 'join' && (
          <div className="stack-lg" style={{ animation: 'rise .35s var(--ease)' }}>
            <div className="stack">
              <h1 className="display" style={{ fontSize: '2.6rem' }}>Rejoindre <em>la boutique</em></h1>
              <p className="soft-t">Demandez l'adresse et la clé à la responsable (Paramètres › Synchronisation).</p>
            </div>
            <Field label="Adresse du serveur"><input id="join-url" className="input lg" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://…" /></Field>
            <Field label="Clé de la boutique"><input id="join-token" className="input lg" type="password" value={token} onChange={(e) => setToken(e.target.value.trim())} /></Field>
            {err && <div className="banner warn">{err}</div>}
            <button className="btn accent lg block" disabled={!url || !token || busy} onClick={async () => {
              setBusy(true); setErr('');
              await setSetting('sync', { url, token });
              await syncNow();
              if (!(await db.users.count())) { setErr("Impossible de récupérer les données. Vérifiez l'adresse, la clé et la connexion Internet."); setBusy(false); }
            }}>{busy ? 'Récupération des données…' : 'Se connecter'}</button>
            <button className="btn ghost" onClick={() => setStep('intro')}><ChevronLeft size={18} />Retour</button>
          </div>
        )}
      </div>
      <aside className="art" style={darkVars}>
        <span className="eyebrow">Le magasin, tel qu'il est</span>
        <h2 className="display" style={{ fontSize: '2.4rem', color: '#f4f4f5' }}>Six zones, <em>une seule</em> vue.</h2>
        <div style={{ maxWidth: 560 }}><StoreMap locations={PREVIEW_ZONES} highlight={new Set(['z1'])} /></div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#1f1f22', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={22} color="#3ccb7f" />
            <div><div className="tiny" style={{ color: '#9a9aa0' }}>Vente JF-0042 · Espèces</div><div style={{ fontWeight: 750, fontSize: '1.15rem' }} className="num">{money(94400)}</div></div>
          </div>
          <div style={{ background: '#1f1f22', borderRadius: 18, padding: '14px 18px' }}>
            <div className="tiny" style={{ color: '#9a9aa0' }}>Ciment CPJ 35 · Entrepôt ciment</div>
            <div style={{ fontWeight: 750, fontSize: '1.15rem' }}>210 sacs</div>
          </div>
        </div>
        <div className="row tiny" style={{ color: '#9a9aa0', gap: 10 }}><LogoMark size={22} />Conçu pour AYOKA QUINCA, Sèmè-Podji</div>
      </aside>
    </div>
  );
}
