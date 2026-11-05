import {
  Package, Construction, PanelTop, Layers, LayoutGrid, Droplets, Wrench, Cable, Plug, Lock, Hammer, FlaskConical, Boxes, type LucideIcon,
} from 'lucide-react';
import { norm } from '../domain/format';

/**
 * Logo AYOKA QUINCA.
 * Un « A » dessiné comme une ferme de toit (deux chevrons), traversé par une poutre orange :
 * on y lit la lettre, le bâtiment et l'outil. Fond graphite, angles adoucis façon icône d'app.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AYOKA QUINCA" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="64" height="64" rx="18" fill="#141414" />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="17.25" fill="none" stroke="#ffffff" strokeOpacity=".08" strokeWidth="1.5" />
      <path d="M17 47 32 17l15 30" fill="none" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20.5" y="34" width="23" height="6.5" rx="3.25" fill="#F0601B" />
    </svg>
  );
}

export function Logo({ size = 40, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={size} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={{ fontWeight: 800, letterSpacing: '.06em', fontSize: size * 0.38 }}>AYOKA QUINCA</span>
        {sub && <span className="tiny muted" style={{ letterSpacing: '.04em', fontWeight: 600, marginTop: 3 }}>Quincaillerie · Sèmè-Podji</span>}
      </span>
    </span>
  );
}

/** Avatar par défaut : silhouette sur fond teinté de la couleur de la personne. */
export function Avatar({ color, size, name }: { name?: string; color: string; size?: 'sm' | 'lg' }) {
  return (
    <span className={`avatar ${size ?? ''}`} aria-label={name} role="img">
      <svg viewBox="0 0 64 64">
        <rect width="64" height="64" fill={color} fillOpacity=".16" />
        <circle cx="32" cy="25" r="11.5" fill={color} />
        <path d="M10 64c1.5-13.5 10.5-21 22-21s20.5 7.5 22 21z" fill={color} />
      </svg>
    </span>
  );
}

const CAT_ICONS: [RegExp, LucideIcon][] = [
  [/ciment/, Package], [/fer/, Construction], [/tole/, PanelTop], [/contreplaqu|isorel|bois/, Layers],
  [/carrel|faience/, LayoutGrid], [/raccord/, Wrench], [/tube/, Cable], [/tuyau|plomb/, Droplets],
  [/electr/, Plug], [/serrur/, Lock], [/outil/, Hammer], [/acide/, FlaskConical],
];

export function catIcon(name = ''): LucideIcon {
  const n = norm(name);
  return CAT_ICONS.find(([re]) => re.test(n))?.[1] ?? Boxes;
}

/** Pastille de produit : pictogramme de la catégorie, teinté de la couleur de sa zone. */
export function ProductGlyph({ category, color, size = 'md' }: { category?: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = catIcon(category);
  const c = color ?? 'var(--ink-2)';
  return (
    <span className={`glyph ${size === 'md' ? '' : size}`} style={{ background: `color-mix(in srgb, ${c} 14%, var(--surface))`, color: c }}>
      <Icon size={size === 'sm' ? 18 : size === 'lg' ? 26 : 22} strokeWidth={1.9} />
    </span>
  );
}
