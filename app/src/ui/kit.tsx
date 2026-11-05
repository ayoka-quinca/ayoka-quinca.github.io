import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Delete, Search as SearchIcon, X, type LucideIcon } from 'lucide-react';
import type { Location } from '../db';
import { money, qty as fq } from '../domain/format';

/* ---------------- Toasts (avec « Annuler » quand c'est possible) ---------------- */
interface Toast { id: number; text: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.action ? 5000 : 2600);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            {t.action && (
              <button onClick={() => { t.action!.run(); setList((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Sheet (bas d'écran sur mobile, fenêtre sur ordinateur) ---------------- */
export function Sheet({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" style={wide ? { maxWidth: 860 } : undefined} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Fermer"><X size={24} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, text, confirm = 'Confirmer', danger, onYes, onClose }: { title: string; text: ReactNode; confirm?: string; danger?: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        <div>{text}</div>
        <div className="grid-2">
          <button className="btn lg" onClick={onClose}>Non, retour</button>
          <button className={`btn lg ${danger ? 'danger' : 'primary'}`} onClick={() => { onYes(); onClose(); }}>{confirm}</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- Barre du haut ---------------- */
export function TopBar({ title, back, right }: { title: ReactNode; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="iconbtn" aria-label="Retour" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <ArrowLeft size={24} />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

/* ---------------- Recherche ---------------- */
export function SearchBox({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="search">
      <SearchIcon size={22} />
      <input ref={ref} className="input" type="search" inputMode="search" value={value} placeholder={placeholder}
        autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && (
        <button className="iconbtn clear" aria-label="Effacer" onClick={() => { onChange(''); ref.current?.focus(); }}><X size={20} /></button>
      )}
    </div>
  );
}

/* ---------------- Pavé numérique (montants, quantités, code PIN) ---------------- */
export function NumPad({ onKey, okLabel, onOk }: { onKey: (k: string) => void; okLabel?: string; onOk?: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="numpad">
      {keys.map((k) => <button key={k} type="button" onClick={() => onKey(k)}>{k}</button>)}
      {onOk ? <button type="button" onClick={() => onKey('back')} aria-label="Effacer"><Delete size={24} /></button> : <button type="button" onClick={() => onKey('00')}>00</button>}
      <button type="button" onClick={() => onKey('0')}>0</button>
      {onOk ? <button type="button" className="ok" onClick={onOk}>{okLabel ?? 'OK'}</button> : <button type="button" onClick={() => onKey('back')} aria-label="Effacer"><Delete size={24} /></button>}
    </div>
  );
}

export function applyKey(v: string, k: string, max = 12): string {
  if (k === 'back') return v.slice(0, -1);
  if (v.length >= max) return v;
  if (v === '0') return k === '00' ? '0' : k;
  return v + k;
}

/* ---------------- Stepper quantité ---------------- */
export function Stepper({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; step?: number }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  return (
    <div className="stepper">
      <button type="button" aria-label="Moins" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−</button>
      <input inputMode="decimal" value={txt} aria-label="Quantité"
        onChange={(e) => { setTxt(e.target.value); const n = Number(e.target.value.replace(',', '.')); if (!Number.isNaN(n) && e.target.value !== '') onChange(Math.max(min, n)); }}
        onBlur={() => setTxt(String(value))} onFocus={(e) => e.target.select()} />
      <button type="button" aria-label="Plus" onClick={() => onChange(+(value + step).toFixed(2))}>+</button>
    </div>
  );
}

/* ---------------- Petits éléments ---------------- */
export const Money = ({ v, className }: { v: number; className?: string }) => <span className={`num ${className ?? ''}`}>{money(v)}</span>;

export function ZoneTag({ loc, locs }: { loc?: Location; locs?: Map<string, Location> }) {
  if (!loc) return null;
  const parent = loc.parentId ? locs?.get(loc.parentId) : undefined;
  return (
    <span className="zone"><i style={{ background: loc.color }} />{parent ? `${parent.name} · ${loc.name}` : loc.name}</span>
  );
}

export function StockBadge({ q, min, unit }: { q: number; min: number; unit?: string }) {
  if (q <= 0) return <span className="badge danger">Épuisé</span>;
  if (q <= min) return <span className="badge warn">Stock bas · {fq(q)} {unit}</span>;
  return <span className="badge ok">{fq(q)} {unit}</span>;
}

export function Empty({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={40} strokeWidth={1.5} />
      <h3 style={{ color: 'var(--ink-2)' }}>{title}</h3>
      {text && <p className="small">{text}</p>}
      {children}
    </div>
  );
}

export function Avatar({ name, color, lg }: { name: string; color: string; lg?: boolean }) {
  return <span className={`avatar ${lg ? 'lg' : ''}`} style={{ background: color }}>{name.trim().charAt(0).toUpperCase()}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint-t">{hint}</span>}
    </div>
  );
}
