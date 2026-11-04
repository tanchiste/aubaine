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

const HOURS = Array.from({ length: 17 }, (_, i) => i + 8);
type Preset = { key: string; label: string; hint: string; href: string; active: boolean };

/** Horaire : toute la journée, un moment, ou une plage précise, dans un seul menu */
export function TimeMenu({ label, presets, de, a, preciseHref }: { label: string; presets: Preset[]; de?: number; a?: number; preciseHref: string }) {
  const { open, setOpen, ref } = usePopover();
  const router = useRouter();
  const [from, setFrom] = useState(de ?? 14);
  const [to, setTo] = useState(a ?? 16);
  const go = (f: number, t: number) => {
    setOpen(false);
    router.push(preciseHref.replace('__DE__', String(f)).replace('__A__', String(t)));
  };
  return (
    <div className="picker" ref={ref}>
      <button type="button" className="tool-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconClock size={16} />
        <span>{label}</span>
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
          <div className="menu-sep" />
          <div className="menu-precise">
            <span className="label">Heure précise</span>
            <div className="hour-quick">
              {[10, 12, 14, 16, 18, 20].map((h) => (
                <button key={h} type="button" className="chip" onClick={() => go(h, h + 1)}>
                  Vers {h} h
                </button>
              ))}
            </div>
            <div className="row" style={{ ['--gap' as string]: '8px' }}>
              <select className="select" aria-label="À partir de" value={from} onChange={(e) => { const f = Number(e.target.value); setFrom(f); if (to <= f) setTo(f + 1); }}>
                {HOURS.filter((h) => h < 24).map((h) => <option key={h} value={h}>de {h} h</option>)}
              </select>
              <select className="select" aria-label="Jusqu’à" value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {HOURS.filter((h) => h > from).map((h) => <option key={h} value={h}>à {h === 24 ? 'minuit' : `${h} h`}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => go(from, to)}>OK</button>
            </div>
          </div>
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
