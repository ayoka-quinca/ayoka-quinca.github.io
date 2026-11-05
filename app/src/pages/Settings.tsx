import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building2, Users, Tags, CloudUpload, HardDriveDownload, FileSpreadsheet, History, Plus, Trash2 } from 'lucide-react';
import { db, write, uid, getSetting, setSetting, DEFAULT_COMPANY, type Company, type Role, type User } from '../db';
import { createUser, setPin, ROLE_LABEL, audit } from '../domain/auth';
import { when } from '../domain/format';
import { csvTemplate, download, exportBackup, importBackup, importProductsCsv } from '../domain/backup';
import { onSync, syncNow, type SyncConfig, type SyncState } from '../domain/sync';
import { wipeAll } from '../domain/seed';
import { useCategories, useSession, useUsers } from '../ui/hooks';
import { Avatar, Confirm, Field, Sheet, TopBar, useToast } from '../ui/kit';
import { TextSize } from './More';

const COLORS = ['#0B6E4F', '#B4540A', '#2F6FB0', '#7B4FB0', '#9F1239', '#0E7490'];

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Paramètres" />
      <main className="main">
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', alignItems: 'start' }}>
          <Team />
          <CompanyCard />
          <SyncCard />
          <BackupCard />
          <ImportCard />
          <CategoriesCard />
          <TextSize />
          <Journal />
          <Danger />
        </div>
      </main>
    </>
  );
}

function Team() {
  const users = [...useUsers().values()];
  const { user: me } = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('caissiere');
  const [pin, setPinV] = useState('');
  const open = (u: User | 'new') => { setEdit(u); setName(u === 'new' ? '' : u.name); setRole(u === 'new' ? 'caissiere' : u.role); setPinV(''); };
  return (
    <div className="card stack">
      <div className="row"><Users size={20} /><h3 className="grow">Équipe et codes d'accès</h3></div>
      <div className="list">
        {users.map((u) => (
          <button key={u.id} className="item" onClick={() => open(u)} style={!u.active ? { opacity: .5 } : undefined}>
            <Avatar name={u.name} color={u.color} />
            <div className="grow"><div className="title">{u.name}</div><div className="sub">{ROLE_LABEL[u.role]}{!u.active && ' · désactivé'}</div></div>
          </button>
        ))}
      </div>
      <button className="btn soft" onClick={() => open('new')}><Plus size={18} />Ajouter une personne</button>
      <div className="small muted">Caisse : vend, encaisse les crédits. Vendeur / Magasin : vend, cherche, déplace, compte l'inventaire. Seule la responsable voit les prix d'achat, les bénéfices et peut corriger le stock.</div>
      {edit && (
        <Sheet title={edit === 'new' ? 'Nouvelle personne' : edit.name} onClose={() => setEdit(null)}>
          <div className="stack">
            <Field label="Prénom"><input className="input lg" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Rôle">
              <div className="seg">{(['responsable', 'caissiere', 'employe'] as Role[]).map((r) => <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)} disabled={edit !== 'new' && edit.id === me.id}>{ROLE_LABEL[r]}</button>)}</div>
            </Field>
            <Field label={edit === 'new' ? 'Code secret (4 chiffres)' : 'Nouveau code secret (laisser vide pour garder)'}>
              <input className="input lg num" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(e) => setPinV(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <button className="btn primary lg" disabled={!name.trim() || (edit === 'new' ? pin.length !== 4 : pin.length > 0 && pin.length !== 4)} onClick={async () => {
              if (edit === 'new') { await createUser(name.trim(), role, pin, COLORS[users.length % COLORS.length]); await audit(me.id, 'Utilisateur créé', name); }
              else {
                await db.transaction('rw', db.users, db.outbox, () => write('users', { ...edit, name: name.trim(), role }));
                if (pin) await setPin({ ...edit, name: name.trim(), role }, pin);
              }
              toast({ text: 'Enregistré' }); setEdit(null);
            }}>Enregistrer</button>
            {edit !== 'new' && edit.id !== me.id && (
              <button className="btn ghost danger-t" onClick={async () => {
                await db.transaction('rw', db.users, db.outbox, () => write('users', { ...edit, active: !edit.active }));
                await audit(me.id, edit.active ? 'Utilisateur désactivé' : 'Utilisateur réactivé', edit.name); setEdit(null);
              }}>{edit.active ? 'Désactiver ce compte' : 'Réactiver ce compte'}</button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function CompanyCard() {
  const toast = useToast();
  const [c, setC] = useState<Company | null>(null);
  useEffect(() => { getSetting('company', DEFAULT_COMPANY).then(setC); }, []);
  if (!c) return null;
  const f = (k: keyof Company, label: string) => <Field label={label}><input className="input" value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></Field>;
  return (
    <div className="card stack">
      <div className="row"><Building2 size={20} /><h3>Entreprise (en-tête des factures)</h3></div>
      {f('name', 'Nom')}{f('address', 'Adresse')}{f('phone', 'Téléphone')}{f('email', 'E-mail')}{f('ifu', 'N° IFU')}{f('footer', 'Message en bas du ticket')}
      <button className="btn primary" onClick={async () => { await setSetting('company', c); toast({ text: 'Enregistré' }); }}>Enregistrer</button>
    </div>
  );
}

function SyncCard() {
  const toast = useToast();
  const [cfg, setCfg] = useState<SyncConfig>({ url: '', token: '' });
  const [st, setSt] = useState<SyncState>({ status: 'off', pending: 0 });
  useEffect(() => { getSetting<SyncConfig | null>('sync', null).then((c) => c && setCfg(c)); return onSync(setSt) as () => void; }, []);
  return (
    <div className="card stack">
      <div className="row"><CloudUpload size={20} /><h3>Synchronisation entre appareils</h3></div>
      <div className="small muted">Relie ce téléphone / ordinateur au serveur de la boutique. Sans serveur, les données restent uniquement sur cet appareil.</div>
      <Field label="Adresse du serveur"><input className="input" value={cfg.url} placeholder="https://ayoka.exemple.bj" onChange={(e) => setCfg({ ...cfg, url: e.target.value.trim() })} /></Field>
      <Field label="Clé de la boutique"><input className="input" type="password" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value.trim() })} /></Field>
      <div className="row between">
        <span className={`badge ${st.status === 'idle' ? 'ok' : st.status === 'error' ? 'danger' : 'neutral'}`}>
          {st.status === 'off' ? 'Non configuré' : st.status === 'idle' ? `À jour${st.lastSync ? ' · ' + when(st.lastSync) : ''}` : st.status === 'syncing' ? 'En cours…' : st.status === 'offline' ? 'Hors ligne' : st.error}
        </span>
        <span className="small muted">{st.pending} en attente</span>
      </div>
      <button className="btn primary" onClick={async () => { await setSetting('sync', cfg.url ? cfg : null); toast({ text: 'Réglage enregistré' }); syncNow(); }}>Enregistrer et synchroniser</button>
    </div>
  );
}

function BackupCard() {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const last = useLiveQuery(() => db.settings.get('lastBackup'), []);
  return (
    <div className="card stack">
      <div className="row"><HardDriveDownload size={20} /><h3>Sauvegarde</h3></div>
      <div className="small muted">Dernière sauvegarde manuelle : {last?.value ? when(last.value as number) : 'jamais'}. Envoyez le fichier sur WhatsApp ou Google Drive pour le garder à l'abri.</div>
      <button className="btn primary" onClick={async () => { download(await exportBackup(), `sauvegarde-ayoka-${new Date().toISOString().slice(0, 10)}.json`); await setSetting('lastBackup', Date.now()); }}>Télécharger une sauvegarde</button>
      <input ref={ref} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
      <button className="btn" onClick={() => ref.current?.click()}>Restaurer une sauvegarde…</button>
      {file && <Confirm title="Restaurer ?" danger confirm="Oui, remplacer" onClose={() => setFile(null)} text="Toutes les données actuelles de cet appareil seront remplacées par celles du fichier."
        onYes={async () => { try { await importBackup(file); toast({ text: 'Données restaurées' }); } catch (e) { toast({ text: String((e as Error).message) }); } }} />}
    </div>
  );
}

function ImportCard() {
  const { user } = useSession();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<{ created: number; errors: string[] } | null>(null);
  return (
    <div className="card stack">
      <div className="row"><FileSpreadsheet size={20} /><h3>Importer la liste des produits</h3></div>
      <div className="small muted">Remplissez le modèle dans Excel (une ligne par produit, avec le stock compté), enregistrez en CSV, puis importez-le ici.</div>
      <button className="btn" onClick={() => download(csvTemplate(), 'modele-produits.csv')}>Télécharger le modèle</button>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await importProductsCsv(await f.text(), user.id); setRes(r); toast({ text: `${r.created} produit(s) importé(s)` }); e.target.value = ''; }} />
      <button className="btn primary" onClick={() => ref.current?.click()}>Importer un fichier CSV…</button>
      {res && res.errors.length > 0 && <div className="banner warn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>{res.errors.slice(0, 8).map((e) => <span key={e}>{e}</span>)}</div>}
    </div>
  );
}

function CategoriesCard() {
  const { list } = useCategories();
  const [name, setName] = useState('');
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  return (
    <div className="card stack">
      <div className="row"><Tags size={20} /><h3>Catégories</h3></div>
      <div className="row-wrap">
        {list.map((c) => {
          const used = products.some((p) => p.categoryId === c.id);
          return (
            <span key={c.id} className="chip" style={{ cursor: 'default' }}>{c.name}
              {!used && <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label={`Supprimer ${c.name}`} onClick={async () => { await db.categories.delete(c.id); }}><Trash2 size={14} /></button>}
            </span>
          );
        })}
      </div>
      <div className="row">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" />
        <button className="btn primary" disabled={!name.trim()} onClick={async () => { await db.transaction('rw', db.categories, db.outbox, () => write('categories', { id: uid(), name: name.trim(), order: list.length, updatedAt: 0 })); setName(''); }}>Ajouter</button>
      </div>
    </div>
  );
}

function Journal() {
  const entries = useLiveQuery(() => db.audit.orderBy('at').reverse().limit(40).toArray(), []) ?? [];
  const users = useUsers();
  return (
    <div className="card stack">
      <div className="row"><History size={20} /><h3>Journal des connexions</h3></div>
      <div className="list" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {entries.map((e) => <div key={e.id} className="item" style={{ minHeight: 48 }}><div className="grow"><div className="title small">{users.get(e.userId)?.name} · {e.action}</div>{e.detail && <div className="sub">{e.detail}</div>}</div><span className="small muted">{when(e.at)}</span></div>)}
        {entries.length === 0 && <div className="empty small">Vide</div>}
      </div>
    </div>
  );
}

function Danger() {
  const demo = useLiveQuery(() => db.settings.get('demo'), []);
  const [ask, setAsk] = useState(false);
  return (
    <div className="card stack">
      <h3>{demo?.value ? 'Quitter la démonstration' : 'Effacer cet appareil'}</h3>
      <div className="small muted">{demo?.value ? 'Supprime les données fictives pour démarrer avec votre vraie boutique.' : 'Supprime toutes les données de cet appareil. Faites une sauvegarde avant.'}</div>
      <button className="btn danger" onClick={() => setAsk(true)}>{demo?.value ? 'Effacer les exemples et commencer' : 'Tout effacer'}</button>
      {ask && <Confirm title="Tout effacer ?" danger confirm="Oui, effacer" text="Cette action est définitive sur cet appareil." onClose={() => setAsk(false)} onYes={wipeAll} />}
    </div>
  );
}
