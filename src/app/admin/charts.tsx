import { euros } from '@/lib/format';

/*
 * Graphiques du back-office, dessinés en SVG côté serveur (aucune bibliothèque à charger).
 * Règles : une seule couleur d'accent sur ce dont parle le titre, le reste en gris,
 * grille discrète, valeurs au survol (<title>) et seulement quelques étiquettes visibles.
 */

const ACCENT = '#3A28D4';
const QUIET = '#C9C5DA';
const GRID = '#ECEBF2';
const INK2 = '#6B6882';
const W = 1000;

const dayFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const label = (d: string, long = false) => (long ? longFmt : dayFmt).format(new Date(d + 'T12:00:00Z')).replace('.', '');

/** Graduation « ronde » au-dessus du maximum (1, 2, 5, 10, 20…) */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p;
}

/** Barre à sommet arrondi (4 px) posée sur la ligne de base */
function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export type DayPoint = { date: string; n: number; cents: number };

/**
 * Réservations par jour : les `highlight` derniers jours en couleur, les précédents en gris.
 */
export function DailyBars({ days, highlight = 7, title }: { days: DayPoint[]; highlight?: number; title: string }) {
  const H = 250;
  const left = 36;
  const right = 8;
  const y0 = 16;
  const base = H - 28;
  const max = niceMax(Math.max(...days.map((d) => d.n), 1));
  const band = (W - left - right) / days.length;
  const bw = Math.max(4, band - 3);
  const y = (v: number) => base - (v / max) * (base - y0);
  const ticks = [0, max / 2, max].filter((t) => Number.isInteger(t));
  const from = days.length - highlight;
  const peak = days.reduce((best, d, i) => (d.n > days[best].n ? i : best), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="chart">
      <g>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#D9D7E3' : GRID} />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize="12.5" fill={INK2}>
              {t}
            </text>
          </g>
        ))}
      </g>
      {days.map((d, i) => {
        const x = left + i * band + (band - bw) / 2;
        const on = i >= from;
        return (
          <g key={d.date}>
            <path d={bar(x, y(d.n), bw, base - y(d.n))} fill={on ? ACCENT : QUIET} />
            {(i === peak || i === days.length - 1) && d.n > 0 && (
              <text x={x + bw / 2} y={y(d.n) - 6} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17142E">
                {d.n}
              </text>
            )}
            {(i % 7 === (days.length - 1) % 7) && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="12.5" fill={INK2}>
                {label(d.date)}
              </text>
            )}
            {/* Zone de survol plus large que la barre */}
            <rect x={left + i * band} y={y0} width={band} height={base - y0} fill="transparent">
              <title>{`${label(d.date, true)} : ${d.n} réservation${d.n > 1 ? 's' : ''}${d.cents ? `, ${euros(d.cents)}` : ''}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Montant réservé cumulé jour après jour : ce mois (couleur) contre le mois précédent (gris pointillé).
 */
export function CumulativeLines({ current, previous, monthLabel, prevLabel, title }: { current: number[]; previous: number[]; monthLabel: string; prevLabel: string; title: string }) {
  const H = 270;
  const left = 64;
  const right = 110;
  const y0 = 18;
  const base = H - 28;
  const days = Math.max(current.length, previous.length, 28);
  const max = niceMax(Math.max(...current, ...previous, 100));
  const x = (i: number) => left + (i / (days - 1)) * (W - left - right);
  const y = (v: number) => base - (v / max) * (base - y0);
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ticks = [0, max / 2, max];
  const lastCur = current.length - 1;
  const lastPrev = previous.length - 1;
  // Étiquettes de fin de ligne : écartées si elles se chevauchent
  let yCur = y(current[lastCur] ?? 0);
  let yPrev = y(previous[lastPrev] ?? 0);
  if (Math.abs(yCur - yPrev) < 16) {
    if (yCur <= yPrev) yPrev = yCur + 16;
    else yCur = yPrev + 16;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#D9D7E3' : GRID} />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize="12.5" fill={INK2}>
            {euros(t)}
          </text>
        </g>
      ))}
      {[1, 8, 15, 22, days].map((d) => (
        <text key={d} x={x(d - 1)} y={H - 8} textAnchor="middle" fontSize="12.5" fill={INK2}>
          {d}
        </text>
      ))}
      {previous.length > 0 && (
        <>
          <path d={path(previous)} fill="none" stroke={QUIET} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
          <text x={x(lastPrev) + 8} y={yPrev + 4} fontSize="12.5" fill={INK2}>
            {prevLabel}
          </text>
        </>
      )}
      {current.length > 0 && (
        <>
          <path d={path(current)} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(lastCur)} cy={y(current[lastCur])} r="4.5" fill={ACCENT} stroke="#fff" strokeWidth="2" />
          <text x={x(lastCur) + 10} y={yCur + 4} fontSize="13.5" fontWeight="700" fill="#17142E">
            {euros(current[lastCur])}
          </text>
          <text x={x(lastCur) + 10} y={yCur + 18} fontSize="12.5" fill={INK2}>
            {monthLabel}
          </text>
        </>
      )}
      {/* Survol : une zone par jour avec les deux cumuls */}
      {Array.from({ length: days }, (_, i) => (
        <rect key={i} x={x(i) - (W - left - right) / (days - 1) / 2} y={y0} width={(W - left - right) / (days - 1)} height={base - y0} fill="transparent">
          <title>{`Jour ${i + 1} : ${current[i] !== undefined ? `${euros(current[i])} (${monthLabel})` : '–'}${previous[i] !== undefined ? `, ${euros(previous[i])} (${prevLabel})` : ''}`}</title>
        </rect>
      ))}
    </svg>
  );
}
