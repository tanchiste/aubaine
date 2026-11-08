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
export function TimeMenu({ label, shortLabel, presets, de, preciseHref, pill = false }: { label: string; shortLabel?: string; presets: Preset[]; de?: number; a?: number; preciseHref: string; pill?: boolean }) {
  const { open, setOpen, ref } = usePopover();
  const router = useRouter();
  return (
    <div className="picker" ref={ref}>
      <button type="button" data-menu="time" className={pill ? 'qpill' : 'tool-btn'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconClock size={16} />
        <span className="lbl-long">{label}</span>
        <span className="lbl-short">{shortLabel ?? label}</span>
        <IconChevronDown size={16} />
      </button>
      {open && (
        <div className="picker-menu menu-time" role="dialog" aria-label="Horaire">
          {presets.map((p) => (
            <Link scroll={false} key={p.key} href={p.href} aria-selected={p.active} onClick={() => setOpen(false)}>
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
                router.push(preciseHref.replace('__DE__', String(h)).replace('__A__', String(Math.min(24, h + 2))), { scroll: false });
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
            <Link scroll={false} key={o.key} role="option" href={o.href} aria-selected={o.active} onClick={() => setOpen(false)}>
              <span className="grow">{o.label}</span>
              {o.active && <IconCheck size={16} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Téléphone : le jour, en pastille (aujourd'hui, demain, ou le calendrier) */
export function DateMenu({ label, value, min, max, todayHref, tomorrowHref, pickHref, isToday, isTomorrow, todayInfo, tomorrowInfo }: { label: string; value: string; min: string; max: string; todayHref: string; tomorrowHref: string; pickHref: string; isToday: boolean; isTomorrow: boolean; todayInfo?: string; tomorrowInfo?: string }) {
  const { open, setOpen, ref } = usePopover();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const pick = () => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };
  return (
    <div className="picker" ref={ref}>
      <button type="button" className="qpill" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span>{label}</span>
      </button>
      {open && (
        <div className="picker-menu qmenu" role="dialog" aria-label="Jour">
          <Link scroll={false} href={todayHref} aria-selected={isToday} onClick={() => setOpen(false)}>
            <span className="grow qmenu-day">
              Aujourd’hui
              {todayInfo && <small className={todayInfo === 'aucun créneau' ? 'none' : ''}>{todayInfo}</small>}
            </span>
            {isToday && <IconCheck size={16} />}
          </Link>
          <Link scroll={false} href={tomorrowHref} aria-selected={isTomorrow} onClick={() => setOpen(false)}>
            <span className="grow qmenu-day">
              Demain
              {tomorrowInfo && <small className={tomorrowInfo === 'aucun créneau' ? 'none' : ''}>{tomorrowInfo}</small>}
            </span>
            {isTomorrow && <IconCheck size={16} />}
          </Link>
          <button type="button" className="qmenu-item" aria-selected={!isToday && !isTomorrow} onClick={pick}>
            <span className="grow">{!isToday && !isTomorrow ? label : 'Choisir une date'}</span>
            {!isToday && !isTomorrow ? <IconCheck size={16} /> : <IconChevronDown size={16} />}
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
              if (!e.target.value) return;
              setOpen(false);
              router.push(pickHref.replace('__DATE__', e.target.value), { scroll: false });
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Téléphone : le nombre de personnes, en pastille (un choix, un tap) */
export function PeopleMenu({ n, hrefs, tool = false }: { n: number; hrefs: string[]; tool?: boolean }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="picker" ref={ref}>
      <button type="button" data-menu="people" className={tool ? 'tool-btn' : 'qpill'} aria-haspopup="dialog" aria-expanded={open} aria-label={`${n} personne${n > 1 ? 's' : ''}`} onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="8.5" r="3.2" />
          <path d="M3 19.5c.7-3.3 3-5 6-5s5.3 1.7 6 5" />
          <circle cx="17" cy="9.5" r="2.5" />
          <path d="M16.5 14.6c2.3.2 3.9 1.8 4.5 4.4" />
        </svg>
        <span>{tool ? `${n} personne${n > 1 ? 's' : ''}` : n}</span>
        {tool && <IconChevronDown size={16} />}
      </button>
      {open && (
        <div className="picker-menu qmenu qmenu-people" role="dialog" aria-label="Combien de personnes">
          <span className="label">Combien de personnes ?</span>
          <div className="people-grid">
            {hrefs.map((href, i) => (
              <Link scroll={false} key={href} href={href} aria-current={i + 1 === n ? 'true' : undefined} onClick={() => setOpen(false)}>
                {i + 1}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
