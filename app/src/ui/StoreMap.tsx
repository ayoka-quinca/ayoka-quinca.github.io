import type { Location } from '../db';
import { PLAN } from '../domain/seed';

/** Portes relevées sur le plan (en mètres) : [x1, y1, x2, y2] */
const DOORS: [number, number, number, number][] = [
  [8.0, 14.1, 11.4, 14.1], // entrée principale
  [8.2, 9.0, 11.0, 9.0], // hall → magasin principal
  [9.0, 2.1, 12.1, 2.1], // magasin principal → arrière-cour
  [13.2, 10.6, 13.2, 11.6], // caisse
  [0, 0, 0, 0.8], [0, 2.1, 0, 2.9], [0, 4.2, 0, 5.0], [0, 6.5, 0, 7.3], // accès latéraux
];

const SHORT: Record<string, string> = { MAT: 'Matériaux', CAR: 'Carrelage', CIM: 'Ciment', COUR: 'Arrière-cour (fers)', CAISSE: 'Caisse' };

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
  const pad = 0.5;
  const isOn = (id: string) => selected === id || highlight?.has(id);
  const dim = !!(selected || highlight?.size);
  return (
    <div className="plan">
      <svg viewBox={`${-pad} ${-pad} ${PLAN.w + pad * 2} ${PLAN.h + pad * 2 + 0.8}`} role="img" aria-label="Plan du magasin">
        {zones.map((z) => {
          const r = z.rect!;
          const on = isOn(z.id) || shelves.some((s) => s.parentId === z.id && isOn(s.id));
          const n = counts?.get(z.id);
          const narrow = r.w < 4;
          return (
            <g key={z.id} className="zone-r" onClick={() => onSelect?.(z.id)} opacity={dim && !on ? 0.45 : 1}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={z.color} fillOpacity={on ? 0.32 : 0.14}
                stroke={z.color} strokeWidth={on ? 0.16 : 0.07} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (n !== undefined && !compact ? 0.15 : -0.2)} textAnchor="middle"
                fontSize={narrow ? 0.42 : 0.6} fontWeight={750} fill="var(--ink)">
                {narrow || compact ? SHORT[z.code] ?? z.name : z.name}
              </text>
              {n !== undefined && !compact && (
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.6} textAnchor="middle" fontSize={0.4} fill="var(--ink-2)">
                  {n} article{n > 1 ? 's' : ''}
                </text>
              )}
            </g>
          );
        })}
        {shelves.map((s) => {
          const r = s.rect!;
          const vertical = r.h > r.w;
          return (
            <g key={s.id} className="zone-r" onClick={(e) => { e.stopPropagation(); onSelect?.(s.id); }} opacity={dim && !isOn(s.id) ? 0.5 : 1}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.1} fill={s.color} fillOpacity={isOn(s.id) ? 0.9 : 0.4} stroke={s.color} strokeWidth={0.05} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={0.36} fontWeight={700}
                fill={isOn(s.id) ? '#fff' : 'var(--ink)'} transform={vertical ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}>
                {s.name}
              </text>
            </g>
          );
        })}
        {DOORS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--paper)" strokeWidth={0.22} strokeLinecap="butt" />
        ))}
        <rect x={0} y={0} width={PLAN.w} height={PLAN.h} fill="none" stroke="var(--ink-2)" strokeWidth={0.05} strokeDasharray="0.01 0" opacity={0.25} />
        <text x={9.7} y={PLAN.h + 0.75} textAnchor="middle" fontSize={0.42} fontWeight={700} fill="var(--brand)">▲ Entrée clients</text>
      </svg>
    </div>
  );
}
