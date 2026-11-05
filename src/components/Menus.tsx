'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconCheck, IconChevronDown, IconClock } from './icons';

/** Ouvre / ferme un menu, et le referme au clic à côté ou avec Échap */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** Heures proposées pour « vers » : de 9 h à 22 h */
const VERS = Array.from({ length: 14 }, (_, i) => i + 9);
type Preset = { key: string; label: string; hint: string; href: string; active: boolean };

/** Horaire : toute la journée, un moment, ou « vers 14 h » (créneaux de 14 h à 16 h) */
export function TimeMenu({ label, shortLabel, presets, de, preciseHref }: { label: string; shortLabel?: string; presets: Preset[]; de?: number; a?: number; preciseHref: string }) {
  const { open, setOpen, ref } = usePopover();
  const router = useRouter();
  return (
    <div className="picker" ref={ref}>
      <button type="button" className="tool-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconClock size={16} />
        <span className="lbl-long">{label}</span>
        <span className="lbl-short">{shortLabel ?? label}</span>
        <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="picker-menu menu-time" role="dialog" aria-label="Horaire">
          {presets.map((p) => (
            <Link key={p.key} href={p.href} aria-selected={p.active} onClick={() => setOpen(false)}>
              <span className="grow">{p.label}</span>
              <span className="small muted">{p.hint}</span>
              {p.active && <IconCheck size={16} />}
            </Link>
          ))}
          <label className={`menu-vers${de !== undefined ? ' on' : ''}`}>
            <span className="grow">Vers une heure</span>
            <select
              className="select"
              aria-label="Vers quelle heure"
              value={de ?? ''}
              onChange={(e) => {
                const h = Number(e.target.value);
                setOpen(false);
                router.push(preciseHref.replace('__DE__', String(h)).replace('__A__', String(Math.min(24, h + 2))));
              }}
            >
              <option value="" disabled>Choisir</option>
              {VERS.map((h) => (
                <option key={h} value={h}>{h} h</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/** Tri des résultats, dans un petit menu */
export function SortMenu({ options }: { options: { key: string; label: string; href: string; active: boolean }[] }) {
  const { open, setOpen, ref } = usePopover();
  const current = options.find((o) => o.active) ?? options[0];
  return (
    <div className="picker sort-menu" ref={ref}>
      <button type="button" className="sort-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Trier : <b>{current.label}</b> <IconChevronDown size={14} />
      </button>
      {open && (
        <div className="picker-menu" role="listbox" aria-label="Trier">
          {options.map((o) => (
            <Link key={o.key} role="option" href={o.href} aria-selected={o.active} onClick={() => setOpen(false)}>
              <span className="grow">{o.label}</span>
              {o.active && <IconCheck size={16} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
