'use client';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Bouton « Autre date » qui ouvre le calendrier natif du téléphone ou de l'ordinateur */
export function DatePicker({ value, min, max, hrefBase, label = 'Autre date', pill = false, active = false }: { value: string; min: string; max: string; hrefBase: string; label?: string; pill?: boolean; active?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
    // Le calendrier natif rend le focus au bouton en se fermant : on évite l'anneau qui reste affiché.
    e.currentTarget.blur();
  };
  return (
    <span className="datepick">
      <button type="button" className={pill ? 'day-pill day-pill-cal' : 'day day-cal'} onClick={open} aria-label="Choisir une autre date" aria-current={active ? 'true' : undefined}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span>{label}</span>
      </button>
      <input
        ref={input}
        type="date"
        className="datepick-input"
        aria-label="Date"
        min={min}
        max={max}
        defaultValue={value}
        onChange={(e) => {
          const d = e.target.value;
          if (d) router.push(hrefBase.replace('__DATE__', d), { scroll: false });
        }}
      />
    </span>
  );
}
