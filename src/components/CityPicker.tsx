'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconCheck, IconChevronDown, IconPin } from './icons';

type City = { city: string; n: number };

/** Choix de la ville, mémorisé dans un cookie pour les prochaines visites */
export function CityPicker({ cities, current, hrefFor }: { cities: City[]; current?: string; hrefFor: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const remember = (value: string) => {
    document.cookie = `aub_ville=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
  };
  const total = cities.reduce((s, c) => s + c.n, 0);

  return (
    <div className="picker" ref={box}>
      <button type="button" className="chip picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconPin size={16} /> {current ?? 'Tout le Hainaut'} <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="picker-menu" role="listbox" aria-label="Choisir une ville">
          <Link role="option" aria-selected={!current} href={hrefFor['tout']} onClick={() => remember('tout')}>
            <span className="grow">Tout le Hainaut</span>
            <span className="small muted">{total}</span>
            {!current && <IconCheck size={16} />}
          </Link>
          {cities.map((c) => {
            const active = current?.toLowerCase() === c.city.toLowerCase();
            return (
              <Link key={c.city} role="option" aria-selected={active} href={hrefFor[c.city]} onClick={() => remember(c.city)}>
                <span className="grow">{c.city}</span>
                <span className="small muted">{c.n}</span>
                {active && <IconCheck size={16} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
