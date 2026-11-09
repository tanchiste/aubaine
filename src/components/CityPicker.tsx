'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startNavigation } from './NavProgress';
import { IconCheck, IconChevronDown, IconCompass, IconPin } from './icons';

type City = { city: string; n: number };

const remember = (value: string) => {
  document.cookie = `aub_ville=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * Choix de la ville, ou « Autour de moi » avec la position du téléphone.
 * La position reste dans un cookie du navigateur, arrondie à ~100 m, pendant 12 h.
 */
export function CityPicker({ cities, current, near = false, hasPos = false, hrefFor }: { cities: City[]; current?: string; near?: boolean; hasPos?: boolean; hrefFor: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const locate = () => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Ton navigateur ne partage pas ta position. Choisis une ville.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        document.cookie = `aub_pos=${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}; path=/; max-age=43200; samesite=lax`;
        remember('proche');
        setBusy(false);
        setOpen(false);
        startNavigation();
        router.push(hrefFor.proche, { scroll: false });
        router.refresh();
      },
      (e) => {
        setBusy(false);
        setError(e.code === e.PERMISSION_DENIED ? 'Position refusée. Autorise-la dans ton navigateur, ou choisis une ville.' : 'Position introuvable pour le moment. Réessaie ou choisis une ville.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const forget = () => {
    document.cookie = 'aub_pos=; path=/; max-age=0; samesite=lax';
    remember('tout');
    setOpen(false);
    startNavigation();
    router.push(hrefFor.tout, { scroll: false });
    router.refresh();
  };

  const total = cities.reduce((s, c) => s + c.n, 0);
  const label = near ? 'Autour de moi' : (current ?? 'Tout le Hainaut');

  return (
    <div className="picker" ref={box}>
      <button type="button" className="chip picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {near ? <IconCompass size={16} /> : <IconPin size={16} />} {label} <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="picker-menu" role="listbox" aria-label="Choisir une ville">
          <button type="button" role="option" aria-selected={near} className="picker-near" onClick={locate} disabled={busy}>
            <IconCompass size={18} />
            <span className="grow">{busy ? 'Localisation…' : 'Autour de moi'}</span>
            {near && <IconCheck size={16} />}
          </button>
          {error && <p className="picker-error" role="alert">{error}</p>}
          <Link prefetch={false} scroll={false} role="option" aria-selected={!current && !near} href={hrefFor['tout']} onClick={() => { remember('tout'); setOpen(false); }}>
            <span className="grow">Tout le Hainaut</span>
            <span className="small muted">{total}</span>
            {!current && !near && <IconCheck size={16} />}
          </Link>
          {cities.map((c) => {
            const active = !near && current?.toLowerCase() === c.city.toLowerCase();
            return (
              <Link prefetch={false} scroll={false} key={c.city} role="option" aria-selected={active} href={hrefFor[c.city]} onClick={() => { remember(c.city); setOpen(false); }}>
                <span className="grow">{c.city}</span>
                <span className="small muted">{c.n}</span>
                {active && <IconCheck size={16} />}
              </Link>
            );
          })}
          {hasPos && (
            <button type="button" className="picker-forget" onClick={forget}>
              Ne plus utiliser ma position
            </button>
          )}
        </div>
      )}
    </div>
  );
}
