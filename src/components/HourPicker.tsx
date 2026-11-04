'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconClock } from './icons';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 8); // 8 h → 24 h

/** « Heure précise » : choisir une plage, par exemple de 14 h à 16 h */
export function HourPicker({ from, to, hrefBase }: { from?: number; to?: number; hrefBase: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState(from ?? 14);
  const [a, setA] = useState(to ?? Math.min(24, (from ?? 14) + 2));
  const box = useRef<HTMLDivElement>(null);
  const active = from !== undefined && to !== undefined;

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

  const apply = (f: number, t: number) => {
    setOpen(false);
    router.push(hrefBase.replace('__DE__', String(f)).replace('__A__', String(t)));
  };

  return (
    <div className="picker hour-picker" ref={box}>
      <button type="button" className={`hour-btn${active ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconClock size={16} />
        {active ? (to! - from! === 1 ? `${from} h à ${to} h` : `${from} h – ${to} h`) : 'Heure précise'}
      </button>
      {open && (
        <div className="picker-menu hour-menu" role="dialog" aria-label="Choisir une plage horaire">
          <div className="row" style={{ ['--gap' as string]: '8px' }}>
            <label className="field grow">
              <span>Entre</span>
              <select
                className="select"
                value={de}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDe(v);
                  if (a <= v) setA(Math.min(24, v + 1));
                }}
              >
                {HOURS.filter((h) => h < 24).map((h) => (
                  <option key={h} value={h}>{h} h</option>
                ))}
              </select>
            </label>
            <label className="field grow">
              <span>et</span>
              <select className="select" value={a} onChange={(e) => setA(Number(e.target.value))}>
                {HOURS.filter((h) => h > de).map((h) => (
                  <option key={h} value={h}>{h === 24 ? 'minuit' : `${h} h`}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="hour-quick">
            {[10, 12, 14, 16, 18, 20].map((h) => (
              <button key={h} type="button" className="chip" onClick={() => apply(h, h + 1)}>
                Vers {h} h
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => apply(de, a)}>
            Voir les créneaux de {de} h à {a === 24 ? 'minuit' : `${a} h`}
          </button>
        </div>
      )}
    </div>
  );
}
