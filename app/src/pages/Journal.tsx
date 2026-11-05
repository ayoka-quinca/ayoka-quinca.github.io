import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, ShieldAlert, ArrowRight } from 'lucide-react';
import { db, type AuditEntry, type Change } from '../db';
import { ROLE_LABEL } from '../domain/auth';
import { matches, money, time, PAY_LABEL } from '../domain/format';
import { useCategories, useLocations, useUsers } from '../ui/hooks';
import { Empty, SearchBox, TopBar } from '../ui/kit';
import { Avatar } from '../ui/Brand';

const CREATE: Record<string, string> = {
  products: 'Produit ajouté', clients: 'Client ajouté', suppliers: 'Fournisseur ajouté', sales: 'Vente enregistrée',
  quotes: 'Proforma créée', purchases: 'Marchandise réceptionnée', users: 'Compte créé', categories: 'Catégorie ajoutée',
  locations: 'Emplacement ajouté', inventories: 'Inventaire commencé',
};
const UPDATE: Record<string, string> = {
  products: 'Fiche produit modifiée', clients: 'Fiche client modifiée', suppliers: 'Fournisseur modifié', users: 'Compte modifié',
  categories: 'Catégorie modifiée', locations: 'Emplacement modifié', purchases: 'Réception modifiée',
};
const ACTION: Record<string, string> = { login: 'Connexion', logout: 'Déconnexion', stock: 'Stock modifié', inventory: 'Inventaire validé' };

const FIELD: Record<string, string> = {
  name: 'Nom', salePrice: 'Prix de vente', purchasePrice: "Prix d'achat", minStock: "Seuil d'alerte", locationId: 'Emplacement',
  categoryId: 'Catégorie', archived: 'Retiré du catalogue', unit: 'Unité', dimensions: 'Dimensions', ref: 'Référence', tiers: 'Prix de gros',
  notes: 'Observations', supplierIds: 'Fournisseurs', phone: 'Téléphone', address: 'Adresse', role: 'Rôle', active: 'Compte actif',
  pinHash: 'Code secret', cancelled: 'Annulée', status: 'État', items: 'Articles', paid: 'Payé', color: 'Couleur',
};
const MONEY = new Set(['salePrice', 'purchasePrice', 'paid', 'total']);
/** Champs techniques jamais affichés. */
const HIDDEN = new Set(['items', 'color', 'saleId', 'clientId', 'supplierId', 'productId', 'validatedAt', 'lines', 'parentId', 'rect', 'order', 'code']);

export function titleOf(e: AuditEntry): string {
  if (e.action === 'create') {
    if (e.table === 'payments') return e.flag === 'Dette reprise du cahier' ? 'Dette reprise du cahier' : e.flag ? 'Argent rendu au client' : 'Paiement de crédit reçu';
    return CREATE[e.table ?? ''] ?? 'Création';
  }
  if (e.action === 'update') {
    if (e.table === 'sales') return e.changes?.some((c) => c.field === 'cancelled') ? 'Vente annulée' : "Retour d'articles";
    if (e.table === 'quotes') { const st = e.changes?.find((c) => c.field === 'status')?.after; return st === 'converti' ? 'Proforma transformée en vente' : st === 'annule' ? 'Proforma annulée' : 'Proforma modifiée'; }
    return UPDATE[e.table ?? ''] ?? 'Modification';
  }
  return ACTION[e.action] ?? e.action;
}

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const onlyFlags = params.get('f') === 'alerte';
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const users = useUsers();
  const { map: locs } = useLocations();
  const { map: cats } = useCategories();
  const entries = useLiveQuery(() => db.audit.orderBy('at').reverse().limit(500).toArray(), []) ?? [];

  const fmt = (c: Change, v: unknown): string => {
    if (v === undefined || v === null || v === '') return '—';
    if (MONEY.has(c.field) && typeof v === 'number') return money(v);
    if (c.field === 'locationId') return locs.get(String(v))?.name ?? '—';
    if (c.field === 'categoryId') return cats.get(String(v))?.name ?? '—';
    if (c.field === 'role') return ROLE_LABEL[v as keyof typeof ROLE_LABEL] ?? String(v);
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    if (c.field === 'tiers' && Array.isArray(v)) return v.length ? v.map((t: any) => `dès ${t.minQty} → ${money(t.price)}`).join(', ') : 'aucun';
    if (Array.isArray(v)) return `${v.length} élément(s)`;
    if (c.field === 'status') return ({ ouvert: 'En cours', converti: 'Vendue', annule: 'Annulée', en_cours: 'En cours', valide: 'Validé' } as Record<string, string>)[String(v)] ?? String(v);
    return String(v);
  };

  const list = useMemo(() => entries.filter((e) =>
    (!onlyFlags || e.flag) && (!who || e.userId === who) &&
    matches(`${titleOf(e)} ${e.label ?? ''} ${e.detail ?? ''} ${e.flag ?? ''} ${users.get(e.userId)?.name ?? ''}`, q),
  ), [entries, onlyFlags, who, q, users]);

  const groups = useMemo(() => {
    const g = new Map<string, AuditEntry[]>();
    for (const e of list) {
      const k = new Date(e.at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      g.set(k, [...(g.get(k) ?? []), e]);
    }
    return [...g];
  }, [list]);
  const flagged = entries.filter((e) => e.flag).length;

  const link = (e: AuditEntry) =>
    e.table === 'products' ? `/stock/${e.recordId}` : e.table === 'sales' ? `/ventes/${e.recordId}` : e.table === 'clients' ? `/clients/${e.recordId}` : e.table === 'quotes' ? `/proformas/${e.recordId}` : undefined;

  return (
    <>
      <TopBar title="Journal d'activité" />
      <main className="main stack-lg">
        <p className="soft-t" style={{ maxWidth: 620 }}>Tout ce qui a été fait dans la boutique : qui, quoi, quand, et ce qui a changé. Les actions sensibles sont marquées pour que vous puissiez les vérifier.</p>
        <div className="stack">
          <div className="seg" style={{ maxWidth: 420 }}>
            <button className={!onlyFlags ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>Tout</button>
            <button className={onlyFlags ? 'on' : ''} onClick={() => setParams({ f: 'alerte' }, { replace: true })}>À vérifier{flagged ? ` (${flagged})` : ''}</button>
          </div>
          <div className="chips">
            <button className={`chip ${!who ? 'on' : ''}`} onClick={() => setWho('')}>Toute l'équipe</button>
            {[...users.values()].map((u) => (
              <button key={u.id} className={`chip ${who === u.id ? 'on' : ''}`} onClick={() => setWho(who === u.id ? '' : u.id)} style={{ paddingLeft: 6 }}>
                <Avatar name={u.name} color={u.color} size="sm" />{u.name}
              </button>
            ))}
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Rechercher : ciment, prix, annulée…" />
        </div>

        {groups.length === 0 ? (
          <Empty icon={onlyFlags ? ShieldAlert : History} title={onlyFlags ? 'Rien à vérifier' : 'Aucune activité'} text={onlyFlags ? 'Aucune action sensible sur la période.' : undefined} />
        ) : groups.map(([day, items]) => (
          <section key={day} className="stack" style={{ gap: 10 }}>
            <span className="eyebrow" style={{ paddingLeft: 4 }}>{day}</span>
            <div className="list">
              {items.map((e) => {
                const u = users.get(e.userId);
                const to = link(e);
                const body = (
                  <>
                    {u ? <Avatar name={u.name} color={u.color} /> : <span className="glyph"><History size={18} /></span>}
                    <div className="grow stack" style={{ gap: 4 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <span className="title">{titleOf(e)}</span>
                        {e.flag && <span className="badge accent"><ShieldAlert size={12} />{e.flag}</span>}
                      </div>
                      <div className="sub">
                        <strong style={{ color: 'var(--ink-2)', fontWeight: 650 }}>{u?.name ?? 'Système'}</strong> · {time(e.at)}
                        {e.label && <> · {e.label}</>}
                        {e.detail && <> · {e.detail.replace(/ · (especes|mtn|moov|credit)$/, (_, m) => ' · ' + PAY_LABEL[m])}</>}
                      </div>
                      {e.changes && e.changes.filter((c) => !HIDDEN.has(c.field)).length > 0 && (
                        <div className="stack" style={{ gap: 4, marginTop: 4 }}>
                          {e.changes.filter((c) => !HIDDEN.has(c.field)).slice(0, 5).map((c) => (
                            <div key={c.field} className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <span className="muted" style={{ minWidth: 110 }}>{FIELD[c.field] ?? c.field}</span>
                              <span className="num" style={{ textDecoration: 'line-through', color: 'var(--ink-3)' }}>{fmt(c, c.before)}</span>
                              <ArrowRight size={14} className="muted" />
                              <strong className="num">{fmt(c, c.after)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
                return to ? <Link key={e.id} to={to} className="item" style={{ alignItems: 'flex-start' }}>{body}</Link> : <div key={e.id} className="item" style={{ alignItems: 'flex-start', cursor: 'default' }}>{body}</div>;
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
