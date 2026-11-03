'use client';
import { useActionState, useState } from 'react';
import { createSlotsAction, type SlotFormState } from './actions';

const DOW = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mer'], ['4', 'Jeu'], ['5', 'Ven'], ['6', 'Sam'], ['7', 'Dim']];

export function SlotForm({ venueId, date, capacity, discount, unit }: { venueId: string; date: string; capacity: number; discount: number; unit: string }) {
  const [state, action, pending] = useActionState<SlotFormState, FormData>(createSlotsAction, {});
  const [repeat, setRepeat] = useState(false);
  const [pct, setPct] = useState(discount);
  return (
    <form action={action} className="card stack" style={{ ['--gap' as string]: '14px' }}>
      <input type="hidden" name="venueId" value={venueId} />
      <h2 style={{ fontSize: 15, fontWeight: 800 }}>Ouvrir des créneaux creux</h2>
      <div className="grid-3">
        <label className="field">
          <span>{repeat ? 'À partir du' : 'Jour'}</span>
          <input className="input" type="date" name="date" defaultValue={date} required />
        </label>
        <label className="field">
          <span>Heure</span>
          <input className="input" type="time" name="time" defaultValue="14:00" step={300} required />
        </label>
        <label className="field">
          <span>{unit === 'places' ? 'Places' : 'Salles'}</span>
          <input className="input" type="number" name="capacity" min={1} max={200} defaultValue={capacity} required />
        </label>
      </div>
      <label className="field">
        <span>Remise : −{pct} %</span>
        <input type="range" name="discountPct" min={20} max={60} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ accentColor: 'var(--primary)' }} />
      </label>
      <label className="row" style={{ ['--gap' as string]: '8px', fontWeight: 600, fontSize: 14 }}>
        <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
        Répéter chaque semaine
      </label>
      {repeat && (
        <div className="stack" style={{ ['--gap' as string]: '10px' }}>
          <div className="chips" role="group" aria-label="Jours">
            {DOW.map(([v, l]) => (
              <label key={v} className="chip" style={{ cursor: 'pointer', gap: 6 }}>
                <input type="checkbox" name="dow" value={v} defaultChecked={Number(v) <= 5} style={{ accentColor: 'var(--primary)' }} /> {l}
              </label>
            ))}
          </div>
          <label className="field" style={{ maxWidth: 200 }}>
            <span>Pendant</span>
            <select className="select" name="weeks" defaultValue="4">
              {[1, 2, 4, 8, 12].map((w) => <option key={w} value={w}>{w} semaine{w > 1 ? 's' : ''}</option>)}
            </select>
          </label>
        </div>
      )}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p className="notice notice-ok small" role="status">{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Ouverture…' : 'Ouvrir'}</button>
    </form>
  );
}
