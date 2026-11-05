import type { Location } from '../db';
import { PLAN } from '../domain/seed';

/** Portes relevées sur le plan (en mètres) : [x1, y1, x2, y2] */
const DOORS: [number, number, number, number][] = [
  [8.0, 14.1, 11.4, 14.1], // entrée principale
  [8.2, 9.0, 11.0, 9.0], // hall → magasin principal
  [9.0, 2.1, 12.1, 2.1], // magasin principal → arrière-cour
  [13.2, 10.6, 13.2, 11.6], // caisse
  [0, 0.3, 0, 1.1], [0, 2.5, 0, 3.3], [0, 4.6, 0, 5.4], [0, 6.9, 0, 7.7], // accès latéraux
];

const SHORT: Record<string, string> = { MAT: 'Matériaux', CAR: 'Carrelage', CIM: 'Ciment', COUR: 'Arrière-cour · fers', CAISSE: 'Caisse' };

/**
 * Plan du magasin à l'échelle (1 unité = 1 mètre).
 * Rendu net : aplats opaques (pas de transparence superposée), contours fins mais pleins,
 * textes en gras sans effet d'opacité, de sorte que rien ne paraisse flou.
 */
export function StoreMap({ locations, selected, highlight, counts, onSelect, compact }: {
  locations: Location[];
  selected?: string;
  highlight?: Set<string>;
  counts?: Map<string, number>;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const zones = locations.filter((l) => !l.parentId && l.rect);
  const shelves = locations.filter((l) => l.parentId && l.rect);
  const pad = 0.4;
  const isOn = (id: string) => selected === id || !!highlight?.has(id);
  const dim = !!(selected || highlight?.size);
  const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, #ffffff)`;
  return (
    <div className="plan">
      <svg viewBox={`${-pad} ${-pad} ${PLAN.w + pad * 2} ${PLAN.h + pad * 2 + 0.9}`} role="img" aria-label="Plan du magasin" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
        <rect x={-0.12} y={-0.12} width={PLAN.w + 0.24} height={PLAN.h + 0.24} rx={0.5} fill="#ffffff" stroke="#141414" strokeWidth={0.12} />
        {zones.map((z) => {
          const r = z.rect!;
          const on = isOn(z.id) || shelves.some((s) => s.parentId === z.id && isOn(s.id));
          const faded = dim && !on;
          const n = counts?.get(z.id);
          const narrow = r.w < 4;
          const fs = narrow ? 0.44 : 0.62;
          // Zone avec étagères : le nom passe en haut pour ne pas chevaucher les rayonnages.
          const top = shelves.some((s) => s.parentId === z.id);
          const ly = top ? r.y + 0.8 : r.y + r.h / 2 + (n !== undefined && !compact ? -0.1 : fs * 0.35);
          return (
            <g key={z.id} className="zone-r" onClick={() => onSelect?.(z.id)} role="button" aria-label={z.name}>
              <rect x={r.x + 0.08} y={r.y + 0.08} width={r.w - 0.16} height={r.h - 0.16} rx={0.3}
                fill={faded ? '#f3f2ef' : mix(z.color, on ? 26 : 12)} stroke={faded ? '#d9d6d0' : z.color} strokeWidth={on ? 0.12 : 0.06} />
              <text x={r.x + r.w / 2} y={ly} textAnchor="middle"
                fontSize={fs} fontWeight={750} fill={faded ? '#9a968f' : '#141414'}>
                {narrow || compact ? SHORT[z.code] ?? z.name : z.name}
              </text>
              {n !== undefined && !compact && (
                <text x={r.x + r.w / 2} y={top ? r.y + r.h - 0.45 : r.y + r.h / 2 + 0.62} textAnchor="middle" fontSize={0.4} fontWeight={600} fill={faded ? '#b3afa8' : '#55534f'}>
                  {n} produit{n > 1 ? 's' : ''}
                </text>
              )}
            </g>
          );
        })}
        {shelves.map((s) => {
          const r = s.rect!;
          const vertical = r.h > r.w;
          const on = isOn(s.id);
          const parentOn = s.parentId ? isOn(s.parentId) : false;
          const faded = dim && !on && !parentOn;
          return (
            <g key={s.id} className="zone-r" onClick={(e) => { e.stopPropagation(); onSelect?.(s.id); }} role="button" aria-label={s.name}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.2} fill={on ? s.color : faded ? '#e9e7e3' : mix(s.color, 40)} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={0.42} fontWeight={750}
                fill={on ? '#ffffff' : faded ? '#9a968f' : '#141414'} transform={vertical ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}>
                {s.name}
              </text>
            </g>
          );
        })}
        {DOORS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={0.3} />
        ))}
        <g transform={`translate(9.7 ${PLAN.h + 0.85})`}>
          <path d="M-0.3 0.1 0 -0.3 0.3 0.1z" fill="#B8410A" transform="translate(-1.9 -0.12)" />
          <text x={0.2} y={0} textAnchor="middle" fontSize={0.42} fontWeight={750} fill="#B8410A">Entrée clients</text>
        </g>
      </svg>
    </div>
  );
}
