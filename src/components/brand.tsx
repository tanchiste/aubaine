import type { VenueCategory } from '@/db/schema';

/**
 * Identité visuelle d'Aubaine.
 * Le logo est une horloge dont la part rouge est un moment de la journée à prix réduit :
 * on réutilise cette « part » pour mesurer les remises, et des pictogrammes au trait épais
 * (même épaisseur que le cercle du logo) pour illustrer les activités sans photo.
 */

/** Grande horloge de l'en-tête : la part rouge vaut la meilleure remise affichée */
export function HeroDial({ pct, size = 168 }: { pct: number; size?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg className="hero-dial" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="none" stroke="var(--dial-ring)" strokeWidth="9" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="60" y1="14" x2="60" y2={i % 3 === 0 ? 22 : 18} stroke="var(--dial-tick)" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${i * 30} 60 60)`} />
      ))}
      <circle
        className="hero-dial-wedge"
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--dial-wedge)"
        strokeWidth={r * 2}
        strokeDasharray={`${len} ${c}`}
        transform="rotate(-90 60 60)"
        style={{ ['--len' as string]: `${len}` }}
      />
      <circle cx="60" cy="60" r="7" fill="var(--dial-hub)" />
    </svg>
  );
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/** Pictogrammes des activités (64 × 64), au trait */
export function Pictogram({ category, size = 64 }: { category: VenueCategory; size?: number }) {
  const body = (() => {
    switch (category) {
      case 'karting':
        return (
          <>
            <path {...P} d="M8 40h34l6-8h8M14 40l4-10h14l4 10" />
            <circle {...P} cx="16" cy="46" r="6" />
            <circle {...P} cx="46" cy="46" r="6" />
            <circle {...P} cx="27" cy="22" r="6" />
          </>
        );
      case 'escape':
        return (
          <>
            <circle {...P} cx="20" cy="32" r="10" />
            <circle {...P} cx="20" cy="32" r="3" />
            <path {...P} d="M30 32h26M48 32v8M54 32v6" />
          </>
        );
      case 'laser':
        return (
          <>
            <circle {...P} cx="32" cy="32" r="20" />
            <circle {...P} cx="32" cy="32" r="11" />
            <circle {...P} cx="32" cy="32" r="2.5" />
            <path {...P} d="M32 4v8M32 52v8M4 32h8M52 32h8" />
          </>
        );
      case 'vr':
        return (
          <>
            <rect {...P} x="8" y="22" width="48" height="22" rx="8" />
            <circle {...P} cx="22" cy="33" r="5" />
            <circle {...P} cx="42" cy="33" r="5" />
            <path {...P} d="M28 44l4-5 4 5M8 30H4M60 30h-4" />
          </>
        );
      case 'bowling':
        return (
          <>
            <path {...P} d="M20 8c-4 0-5 5-3 9 2 4-5 9-5 19 0 8 3 18 8 18s8-10 8-18c0-10-7-15-5-19 2-4 1-9-3-9z" />
            <path {...P} d="M15 22h10" />
            <circle {...P} cx="44" cy="44" r="12" />
            <circle cx="40" cy="40" r="1.8" fill="currentColor" />
            <circle cx="46" cy="38" r="1.8" fill="currentColor" />
            <circle cx="43" cy="45" r="1.8" fill="currentColor" />
          </>
        );
      case 'hache':
        return (
          <>
            <path {...P} d="M18 56L44 14" />
            <path {...P} d="M38 10c8 0 16 6 18 14-6 2-14 1-20-4l2-10z" />
          </>
        );
      case 'bienetre':
        return (
          <>
            <path {...P} d="M6 42c6-4 10-4 16 0s10 4 16 0 10-4 16 0" />
            <path {...P} d="M6 52c6-4 10-4 16 0s10 4 16 0 10-4 16 0" />
            <circle {...P} cx="22" cy="22" r="6" />
            <circle {...P} cx="38" cy="14" r="4" />
            <circle {...P} cx="42" cy="28" r="3" />
          </>
        );
      default:
        return <path {...P} d="M32 8l6 16 16 2-12 11 4 17-14-9-14 9 4-17-12-11 16-2z" />;
    }
  })();
  return (
    <svg className="pictogram" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {body}
    </svg>
  );
}
