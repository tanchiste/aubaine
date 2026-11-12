'use client';
import { useRouter } from 'next/navigation';
import { startNavigation } from './NavProgress';

/** Ouvre le calendrier natif au clic (ordinateur) ; sur téléphone, toucher le champ suffit */
export const openNativePicker = (e: React.MouseEvent<HTMLInputElement>) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    // Navigateur sans showPicker : le champ s'ouvre de lui-même au toucher.
  }
};

/**
 * Bouton « Autre date » qui ouvre le calendrier natif du téléphone ou de l'ordinateur.
 * Le champ date, transparent, est posé sur le bouton : c'est lui qu'on touche. Sur iPhone,
 * un champ caché ouvert par programme ne réagit pas, d'où ce montage.
 */
export function DatePicker({ value, min, max, hrefBase, label = 'Autre date', pill = false, active = false }: { value: string; min: string; max: string; hrefBase: string; label?: string; pill?: boolean; active?: boolean }) {
  const router = useRouter();
  return (
    <span className="datepick">
      <span className={pill ? 'day-pill day-pill-cal' : 'day day-cal'} aria-hidden="true" aria-current={active ? 'true' : undefined}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span>{label}</span>
      </span>
      <input
        type="date"
        className="datepick-input"
        aria-label={`${label} : choisir une date`}
        min={min}
        max={max}
        defaultValue={value}
        onClick={openNativePicker}
        onChange={(e) => {
          const d = e.target.value;
          if (d) {
            startNavigation();
            router.push(hrefBase.replace('__DATE__', d), { scroll: false });
          }
        }}
      />
    </span>
  );
}
