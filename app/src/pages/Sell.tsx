import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, User, CheckCircle2, Printer, MessageCircle, Plus, Banknote, Smartphone, NotebookPen, AlertTriangle, ShoppingCart, Pencil, FileText } from 'lucide-react';
import { db, type Client, type PayMethod, type Product, type Sale } from '../db';
import { matches, money, qty as fq, PAY_LABEL } from '../domain/format';
import { createSale, createQuote, setQuoteStatus, priceFor, type CartLine } from '../domain/ops';
import { ProductGlyph } from '../ui/Brand';
import { useCategories, useLocations, useProducts, useSession, useStockMap } from '../ui/hooks';
import { applyKey, Empty, NumPad, SearchBox, Sheet, Stepper, TopBar, ZoneTag, useToast } from '../ui/kit';
import { ClientPicker } from '../ui/ClientPicker';
import { Ticket, shareSale, useCompany } from '../ui/Ticket';

interface Line { productId: string; qty: number; unitPrice: number; custom: boolean }

function loadCart(): Line[] {
  try { return JSON.parse(sessionStorage.getItem('aq.cart') ?? '[]'); } catch { return []; }
}

export default function SellPage() {
  const { user } = useSession();
  const toast = useToast();
  const products = useProducts();
  const stock = useStockMap();
  const { list: cats, map: catMap } = useCategories();
  const nav = useNavigate();
  const [quoting, setQuoting] = useState(false);
  // Vente issue d'une proforma : on retrouve le client et on marque la proforma « vendue ».
  const fromQuote = useMemo<{ id: string; clientId?: string } | null>(() => { try { return JSON.parse(sessionStorage.getItem('aq.fromQuote') ?? 'null'); } catch { return null; } }, []);
  const quoteClient = useLiveQuery(() => (fromQuote?.clientId ? db.clients.get(fromQuote.clientId) : undefined), [fromQuote?.clientId]);
  const { map: locs } = useLocations();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('top');
  const [cart, setCart] = useState<Line[]>(loadCart);
  const [picking, setPicking] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<{ sale: Sale; change: number; phone?: string } | null>(null);
  useEffect(() => sessionStorage.setItem('aq.cart', JSON.stringify(cart)), [cart]);

  // « Les plus vendus » des 30 derniers jours : la caissière retrouve 80 % des ventes sans chercher.
  const top = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.sales.where('at').above(Date.now() - 30 * 86400000).each((s) => s.items.forEach((i) => m.set(i.productId, (m.get(i.productId) ?? 0) + 1)));
    return [...m].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, []) ?? [];

  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = useMemo(() => {
    if (q) return products.filter((p) => matches(`${p.name} ${p.ref ?? ''} ${p.dimensions ?? ''}`, q)).slice(0, 60);
    if (cat === 'top') {
      const t = top.map((id) => pmap.get(id)).filter(Boolean) as Product[];
      return (t.length ? t : products).slice(0, 24);
    }
    return products.filter((p) => p.categoryId === cat);
  }, [q, cat, products, top, pmap]);

  const lines: (CartLine & { custom: boolean })[] = cart.map((l) => ({ product: pmap.get(l.productId)!, qty: l.qty, unitPrice: l.unitPrice, custom: l.custom })).filter((l) => l.product);
  const total = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const count = cart.length;

  const addLine = (p: Product, q: number, price: number, custom: boolean) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: q, unitPrice: price, custom }; return n; }
      return [...c, { productId: p.id, qty: q, unitPrice: price, custom }];
    });
  };
  const setQty = (id: string, q: number) => setCart((c) => c.map((l) => {
    if (l.productId !== id) return l;
    const p = pmap.get(id)!;
    return { ...l, qty: q, unitPrice: l.custom ? l.unitPrice : priceFor(p, q) };
  }));
  const remove = (id: string) => {
    const before = cart;
    setCart((c) => c.filter((l) => l.productId !== id));
    toast({ text: 'Article retiré', action: { label: 'Annuler', run: () => setCart(before) } });
  };

  if (done) return <Done {...done} onNew={() => { setDone(null); setQ(''); }} />;

  const cartView = (
    <CartView lines={lines} total={total} locs={locs} onQty={setQty} onRemove={remove} onEdit={(p) => setPicking(p)} onQuote={() => { setCartOpen(false); setQuoting(true); }}
      onCheckout={() => { setCartOpen(false); setCheckout(true); }} onClear={() => { const b = cart; setCart([]); toast({ text: 'Panier vidé', action: { label: 'Annuler', run: () => setCart(b) } }); }} />
  );

  return (
    <>
      <TopBar title="Nouvelle vente" />
      <main className="main">
        <div className="sell-layout">
          <div className="stack">
            <SearchBox value={q} onChange={setQ} placeholder="Rechercher : ciment, fer 10, coude…" />
            {!q && (
              <div className="chips" role="tablist">
                <button className={`chip ${cat === 'top' ? 'on' : ''}`} onClick={() => setCat('top')}>★ Les plus vendus</button>
                {cats.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
              </div>
            )}
            {shown.length === 0 ? (
              <Empty icon={ShoppingCart} title="Aucun produit trouvé" text="Essayez un autre mot, ou vérifiez l'orthographe." />
            ) : (
              <div className="ptiles">
                {shown.map((p) => {
                  const s = stock.get(p.id) ?? 0;
                  const inCart = cart.find((l) => l.productId === p.id);
                  const loc = locs.get(p.locationId);
                  return (
                    <button key={p.id} className={`ptile ${s <= 0 ? 'out' : ''}`} onClick={() => setPicking(p)}>
                      <ProductGlyph category={catMap.get(p.categoryId)?.name} color={loc?.color} size="sm" />
                      {inCart && <span className="incart num">{fq(inCart.qty)}</span>}
                      <span className="name">{p.name}</span>
                      <span className="price num">{money(p.salePrice)}<span className="unit"> / {p.unit}</span></span>
                      <span className={`tiny ${s <= 0 ? 'danger-t' : s <= p.minStock ? 'warn-t' : 'muted'}`} style={{ fontWeight: 650, marginTop: -6 }}>
                        {s <= 0 ? 'Épuisé' : `${fq(s)} en stock`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <aside className="cartpanel card" style={{ flexDirection: 'column' }}>{cartView}</aside>
        </div>
      </main>

      {count > 0 && (
        <div className="cartbar">
          <button className="grow" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setCartOpen(true)}>
            <div className="small" style={{ opacity: .8 }}>{count} article{count > 1 ? 's' : ''} · voir le panier</div>
            <div className="big num" style={{ fontSize: '1.3rem' }}>{money(total)}</div>
          </button>
          <button className="btn accent" onClick={() => setCheckout(true)}>Encaisser</button>
        </div>
      )}

      {cartOpen && <Sheet title="Panier" onClose={() => setCartOpen(false)}>{cartView}</Sheet>}
      {picking && (
        <QtySheet product={picking} stock={stock.get(picking.id) ?? 0} locs={locs} existing={cart.find((l) => l.productId === picking.id)}
          onClose={() => setPicking(null)} onAdd={(q, price, custom) => { addLine(picking, q, price, custom); setPicking(null); setQ(''); }} />
      )}
      {checkout && (
        <Checkout total={total} initialClient={quoteClient} onClose={() => setCheckout(false)} onConfirm={async (method, paid, client, change) => {
          const sale = await createSale({ lines, method, paid, clientId: client?.id, clientName: client?.name, userId: user.id });
          if (fromQuote) { const qt = await db.quotes.get(fromQuote.id); if (qt) await setQuoteStatus(qt, 'converti', sale.id); sessionStorage.removeItem('aq.fromQuote'); }
          setCart([]); setCheckout(false);
          setDone({ sale, change, phone: client?.phone });
        }} />
      )}
      {quoting && (
        <QuoteSheet total={total} onClose={() => setQuoting(false)} onCreate={async (client, validDays, notes) => {
          const q = await createQuote({ lines, clientId: client?.id, clientName: client?.name, clientPhone: client?.phone, validDays, notes, userId: user.id });
          setCart([]); setQuoting(false);
          toast({ text: `Proforma ${q.number} créée` });
          nav(`/proformas/${q.id}`);
        }} />
      )}
    </>
  );
}

function CartView({ lines, total, locs, onQty, onRemove, onEdit, onCheckout, onClear, onQuote }: {
  lines: (CartLine & { custom: boolean })[]; total: number; locs: Map<string, any>;
  onQty: (id: string, q: number) => void; onRemove: (id: string) => void; onEdit: (p: Product) => void; onCheckout: () => void; onClear: () => void; onQuote: () => void;
}) {
  if (!lines.length) return <Empty icon={ShoppingCart} title="Panier vide" text="Touchez un produit pour l'ajouter." />;
  return (
    <div className="stack" style={{ minHeight: 0, flex: 1 }}>
      <div className="stack" style={{ overflowY: 'auto', minHeight: 0 }}>
        {lines.map((l) => (
          <div key={l.product.id} className="stack" style={{ gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{l.product.name}</div>
                <ZoneTag loc={locs.get(l.product.locationId)} locs={locs} />
              </div>
              <button className="iconbtn" aria-label="Retirer" onClick={() => onRemove(l.product.id)}><Trash2 size={20} /></button>
            </div>
            <div className="row between">
              <Stepper value={l.qty} min={0.01} onChange={(n) => onQty(l.product.id, n)} />
              <button className="btn ghost" style={{ padding: '0 6px', textAlign: 'right', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }} onClick={() => onEdit(l.product)}>
                <span className="num" style={{ fontWeight: 800 }}>{money(l.qty * l.unitPrice)}</span>
                <span className="small muted num">{money(l.unitPrice)} / {l.product.unit}{l.custom && ' (négocié)'} <Pencil size={12} /></span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="row between" style={{ alignItems: 'baseline' }}><span className="eyebrow">Total</span><span className="big num">{money(total)}</span></div>
      <button className="btn accent lg block" onClick={onCheckout}>Encaisser {money(total)}</button>
      <div className="grid-2">
        <button className="btn" onClick={onQuote}><FileText size={18} />Proforma</button>
        <button className="btn ghost" onClick={onClear}>Vider</button>
      </div>
    </div>
  );
}

/** Choix de la quantité (et prix négocié) : pavé numérique géant + raccourcis. */
function QtySheet({ product: p, stock, locs, existing, onClose, onAdd }: {
  product: Product; stock: number; locs: Map<string, any>; existing?: Line; onClose: () => void; onAdd: (q: number, price: number, custom: boolean) => void;
}) {
  const [txt, setTxt] = useState(existing ? String(existing.qty) : '');
  const [mode, setMode] = useState<'qty' | 'price'>('qty');
  const [priceTxt, setPriceTxt] = useState(existing?.custom ? String(existing.unitPrice) : '');
  const q = Number(txt || '1');
  const auto = priceFor(p, q);
  const price = priceTxt ? Number(priceTxt) : auto;
  const quick = /sac|barre|m²|feuille|mètre/.test(p.unit) ? [5, 10, 20, 50] : [1, 2, 5, 10];
  return (
    <Sheet title={p.name} onClose={onClose}>
      <div className="stack">
        <div className="row between">
          <ZoneTag loc={locs.get(p.locationId)} locs={locs} />
          <span className={`badge ${stock <= 0 ? 'danger' : stock <= p.minStock ? 'warn' : 'ok'}`}>Reste {fq(stock)} {p.unit}</span>
        </div>
        <div className="seg">
          <button className={mode === 'qty' ? 'on' : ''} onClick={() => setMode('qty')}>Quantité : <strong className="num">{fq(q)}</strong></button>
          <button className={mode === 'price' ? 'on' : ''} onClick={() => setMode('price')}>Prix : <strong className="num">{money(price)}</strong></button>
        </div>
        {mode === 'qty' ? (
          <>
            <div className="row-wrap">{quick.map((n) => <button key={n} className="chip" onClick={() => setTxt(String(n))}>{n} {p.unit}</button>)}</div>
            {p.tiers?.length ? <div className="small muted">Prix de gros : {p.tiers.map((t) => `dès ${t.minQty} → ${money(t.price)}`).join(' · ')}</div> : null}
          </>
        ) : (
          <div className="small muted">Prix catalogue : {money(auto)} / {p.unit}. Tapez le prix accordé au client.</div>
        )}
        <div className="amount">
          <span>{mode === 'qty' ? (txt || <span className="ph">1</span>) : (priceTxt ? money(Number(priceTxt)) : <span className="ph">{money(auto)}</span>)}</span>
          <span className="u">{mode === 'qty' ? p.unit : `par ${p.unit}`}</span>
        </div>
        {q > stock && <div className="banner warn"><AlertTriangle size={18} />Le système n'en compte que {fq(Math.max(0, stock))}. Vous pouvez quand même vendre.</div>}
        <NumPad onKey={(k) => mode === 'qty' ? setTxt((v) => applyKey(v, k, 6)) : setPriceTxt((v) => applyKey(v, k, 9))} />
        {mode === 'price' && priceTxt && <button className="btn ghost" onClick={() => setPriceTxt('')}>Revenir au prix catalogue</button>}
        <button className="btn accent lg block" disabled={q <= 0} onClick={() => onAdd(q, price, !!priceTxt)}>
          <Plus size={22} />{existing ? 'Modifier' : 'Ajouter'} · {money(q * price)}
        </button>
      </div>
    </Sheet>
  );
}

function Checkout({ total, initialClient, onClose, onConfirm }: { total: number; initialClient?: Client; onClose: () => void; onConfirm: (m: PayMethod, paid: number, c: Client | undefined, change: number) => Promise<void> }) {
  const [method, setMethod] = useState<PayMethod>('especes');
  const [given, setGiven] = useState('');
  const [client, setClient] = useState<Client | undefined>(initialClient);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const g = Number(given || 0);
  const change = method === 'especes' && g > total ? g - total : 0;
  const advance = method === 'credit' ? Math.min(g, total) : total;
  const bills = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000])].filter((b) => b >= total).slice(0, 4);
  const canGo = (method !== 'credit' || !!client) && (method !== 'especes' || !given || g >= total);
  const methods: { m: PayMethod; icon: typeof Banknote; label: string }[] = [
    { m: 'especes', icon: Banknote, label: 'Espèces' },
    { m: 'mtn', icon: Smartphone, label: 'MTN MoMo' },
    { m: 'moov', icon: Smartphone, label: 'Moov Money' },
    { m: 'credit', icon: NotebookPen, label: 'À crédit' },
  ];
  return (
    <Sheet title="Encaisser" onClose={onClose}>
      <div className="stack">
        <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
          <div className="eyebrow">À payer</div>
          <div className="huge num" style={{ marginTop: 6 }}>{money(total)}</div>
        </div>
        <div className="grid-2">
          {methods.map(({ m, icon: I, label }) => (
            <button key={m} className={`btn lg ${method === m ? 'primary' : 'outline'}`} style={{ borderRadius: 18 }} onClick={() => { setMethod(m); setGiven(''); }}><I size={20} />{label}</button>
          ))}
        </div>
        <button className="btn soft lg" onClick={() => setPicking(true)}>
          <User size={20} />{client ? client.name : method === 'credit' ? 'Choisir le client (obligatoire)' : 'Ajouter le client (facultatif)'}
        </button>
        {(method === 'especes' || method === 'credit') && (
          <>
            <div className="label">{method === 'especes' ? 'Le client donne' : 'Avance versée aujourd\'hui (facultatif)'}</div>
            {method === 'especes' && <div className="row-wrap">{bills.map((b) => <button key={b} className="chip num" onClick={() => setGiven(String(b))}>{b === total ? 'Montant exact' : money(b)}</button>)}</div>}
            <div className="amount"><span>{given ? money(g) : <span className="ph">0 F</span>}</span></div>
            <NumPad onKey={(k) => setGiven((v) => applyKey(v, k, 9))} />
            {method === 'especes' && g > 0 && g < total && <div className="banner warn">Il manque {money(total - g)}</div>}
            {change > 0 && <div className="card tint-warn row between"><strong>Monnaie à rendre</strong><span className="big num">{money(change)}</span></div>}
            {method === 'credit' && <div className="banner info">Reste à crédit : {money(total - advance)}</div>}
          </>
        )}
        <button className="btn accent lg block" disabled={!canGo || busy}
          onClick={async () => { setBusy(true); await onConfirm(method, method === 'credit' ? advance : total, client, change); }}>
          <CheckCircle2 size={22} />Valider la vente
        </button>
      </div>
      {picking && <ClientPicker onClose={() => setPicking(false)} onPick={(c) => { setClient(c); setPicking(false); }} />}
    </Sheet>
  );
}

function Done({ sale, change, phone, onNew }: { sale: Sale; change: number; phone?: string; onNew: () => void }) {
  const company = useCompany();
  const nav = useNavigate();
  const [a4, setA4] = useState(false);
  return (
    <>
      <TopBar title="Vente enregistrée" />
      <main className="main">
        <div className="stack-lg" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ width: 88, height: 88, borderRadius: 44, background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', margin: '16px auto 0' }}><CheckCircle2 size={48} /></span>
          <div>
            <div className="muted">Vente n° {sale.number} · {PAY_LABEL[sale.method]}</div>
            <div className="huge num">{money(sale.total)}</div>
            {sale.total - sale.paid > 0 && <div className="danger-t" style={{ fontWeight: 700 }}>Reste à payer : {money(sale.total - sale.paid)}</div>}
          </div>
          {change > 0 && <div className="card tint-warn"><div style={{ fontWeight: 700 }}>Rendez la monnaie</div><div className="huge num">{money(change)}</div></div>}
          <div className="grid-2">
            <button className="btn lg" onClick={() => { setA4(false); setTimeout(() => window.print(), 50); }}><Printer size={20} />Ticket</button>
            <button className="btn lg" onClick={() => shareSale(sale, company, phone)}><MessageCircle size={20} />WhatsApp</button>
          </div>
          <button className="btn ghost" onClick={() => { setA4(true); setTimeout(() => window.print(), 50); }}>Imprimer une facture A4</button>
          <button className="btn accent lg block" onClick={onNew}><Plus size={22} />Nouvelle vente</button>
          <button className="btn ghost" onClick={() => nav('/')}>Retour à l'accueil</button>
        </div>
      </main>
      <Ticket sale={sale} company={company} a4={a4} />
    </>
  );
}

/** Facture proforma : le panier devient un devis, sans toucher au stock ni à la caisse. */
function QuoteSheet({ total, onClose, onCreate }: { total: number; onClose: () => void; onCreate: (c: Client | undefined, days: number, notes: string) => Promise<void> }) {
  const [client, setClient] = useState<Client | undefined>();
  const [picking, setPicking] = useState(false);
  const [days, setDays] = useState(15);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Facture proforma" onClose={onClose}>
      <div className="stack">
        <div className="small muted">Le client repart avec un devis chiffré. Le stock et la caisse ne bougent pas tant qu'il n'a pas acheté.</div>
        <div className="row between" style={{ alignItems: 'baseline' }}><span className="eyebrow">Montant</span><span className="big num">{money(total)}</span></div>
        <button className="btn outline lg" style={{ borderRadius: 18 }} onClick={() => setPicking(true)}><User size={20} />{client ? client.name : 'Pour quel client ?'}</button>
        <div className="field">
          <label>Prix garantis pendant</label>
          <div className="seg">{[7, 15, 30].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} jours</button>)}</div>
        </div>
        <div className="field"><label htmlFor="quote-notes">Remarque (facultatif)</label><input id="quote-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : livraison sur le chantier d'Akpakpa" /></div>
        <button className="btn accent lg block" disabled={busy} onClick={async () => { setBusy(true); await onCreate(client, days, notes.trim()); }}><FileText size={20} />Créer la proforma</button>
      </div>
      {picking && <ClientPicker onClose={() => setPicking(false)} onPick={(c) => { setClient(c); setPicking(false); }} />}
    </Sheet>
  );
}
