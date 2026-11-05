'use client';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { createSlotsAction, deleteSlotAction, toggleSlotAction, updateSlotAction, type SlotFormState } from './actions';

export type EditorOffer = { id: string; name: string; priceCents: number; priceUnit: 'person' | 'session'; capacity: number; capacityUnit: 'places' | 'groupes'; color: string };

const DISCOUNTS = [20, 25, 30, 35, 40, 50, 60];
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DOW_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const euro = (c: number) => (c / 100).toLocaleString('fr-BE', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const isoDow = (d: string) => ((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;

/** Remise choisie en un tap, avec le prix que verra le client */
function PricePicker({ offer, pct, setPct }: { offer?: EditorOffer; pct: number; setPct: (n: number) => void }) {
  return (
    <div className="field">
      <span className="label">Remise</span>
      <div className="discount-chips" role="radiogroup" aria-label="Remise">
        {DISCOUNTS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={pct === d} onClick={() => setPct(d)}>
            −{d} %
          </button>
        ))}
      </div>
      <input type="hidden" name="discountPct" value={pct} />
      {offer && offer.priceCents > 0 && (
        <p className="price-preview">
          <s>{euro(offer.priceCents)}</s>
          <b>{euro(Math.round((offer.priceCents * (100 - pct)) / 100))}</b>
          <span>{offer.priceUnit === 'session' ? 'la séance' : 'par personne'}, pour le client</span>
        </p>
      )}
    </div>
  );
}

/** Ouvrir un ou plusieurs créneaux */
export function NewSlotForm({ venueId, offers, defaultDate, defaultPct, today, back }: { venueId: string; offers: EditorOffer[]; defaultDate: string; defaultPct: number; today: string; back: string }) {
  const [state, action, pending] = useActionState<SlotFormState, FormData>(createSlotsAction, {});
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
  const offer = offers.find((o) => o.id === offerId);
  const [date, setDate] = useState(defaultDate);
  const [pct, setPct] = useState(DISCOUNTS.includes(defaultPct) ? defaultPct : 30);
  const [repeat, setRepeat] = useState(false);
  const [dows, setDows] = useState<number[]>([isoDow(defaultDate)]);
  const [weeks, setWeeks] = useState(4);

  const count = useMemo(() => (repeat ? Math.max(1, dows.length) * weeks : 1), [repeat, dows, weeks]);

  if (offers.length === 0) {
    return (
      <div className="card stack">
        <b>Commence par ta première prestation</b>
        <p className="small muted">Indique ce que tu vends et son prix (ex. « Session 15 min, 22 € »), puis reviens ouvrir tes créneaux.</p>
        <Link className="btn btn-primary btn-sm" href="/pro/etablissement" style={{ alignSelf: 'flex-start' }}>Ajouter une prestation</Link>
      </div>
    );
  }

  return (
    <form action={action} className="card stack slot-editor" style={{ ['--gap' as string]: '16px' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>Ouvrir des créneaux</h2>
        <Link className="btn btn-sm" href={back}>Fermer</Link>
      </div>
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="offerId" value={offerId} />

      {offers.length > 1 && (
        <div className="field">
          <span className="label">Prestation</span>
          <div className="offer-choice" role="radiogroup">
            {offers.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={o.id === offerId} onClick={() => setOfferId(o.id)} style={{ ['--oc' as string]: o.color }}>
                <b>{o.name}</b>
                <span>{euro(o.priceCents)} {o.priceUnit === 'session' ? 'la séance' : '/ pers.'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          <span>Jour</span>
          <input
            className="input"
            type="date"
            name="date"
            min={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value && !repeat) setDows([isoDow(e.target.value)]);
            }}
            required
          />
        </label>
        <label className="field">
          <span>Heure</span>
          <input className="input" type="time" name="time" step={300} defaultValue="14:00" required />
        </label>
      </div>

      <PricePicker offer={offer} pct={pct} setPct={setPct} />

      <label className="field" style={{ maxWidth: 200 }}>
        <span>{offer?.capacityUnit === 'groupes' ? 'Salles ou pistes' : 'Places'}</span>
        <input key={offerId} className="input" type="number" name="capacity" min={1} max={200} defaultValue={offer?.capacity ?? 1} required />
      </label>

      <div className="field">
        <label className="row" style={{ ['--gap' as string]: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
          <span style={{ fontWeight: 700 }}>Répéter chaque semaine</span>
        </label>
        {repeat && (
          <div className="stack repeat-box" style={{ ['--gap' as string]: '10px' }}>
            <div className="dow-toggles" role="group" aria-label="Jours de la semaine">
              {DOW.map((l, i) => {
                const n = i + 1;
                const on = dows.includes(n);
                return (
                  <label key={n} title={DOW_LONG[i]} className={on ? 'on' : ''}>
                    <input type="checkbox" name="dow" value={n} checked={on} onChange={() => setDows(on ? dows.filter((x) => x !== n) : [...dows, n].sort())} />
                    {l}
                  </label>
                );
              })}
            </div>
            <label className="row" style={{ ['--gap' as string]: '8px' }}>
              <span className="small">pendant</span>
              <select className="select" name="weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={{ width: 'auto', height: 40 }}>
                {[1, 2, 4, 8, 12].map((w) => (
                  <option key={w} value={w}>{w} semaine{w > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p className="notice notice-ok small" role="status">{state.message}</p>}
      <button className="btn btn-primary btn-block" disabled={pending || (repeat && dows.length === 0)}>
        {pending ? 'Ouverture…' : `Ouvrir ${count > 1 ? `jusqu’à ${count} créneaux` : '1 créneau'}`}
      </button>
    </form>
  );
}

export type EditSlot = {
  id: string;
  dayLabel: string;
  time: string;
  discountPct: number;
  capacity: number;
  used: number;
  bookings: number;
  isOpen: boolean;
  past: boolean;
  offer: EditorOffer;
};

/** Modifier un créneau existant */
export function EditSlotForm({ slot, back }: { slot: EditSlot; back: string }) {
  const [state, action, pending] = useActionState<SlotFormState, FormData>(updateSlotAction, {});
  const [pct, setPct] = useState(slot.discountPct);
  const locked = slot.bookings > 0 || slot.past;
  return (
    <div className="card stack slot-editor" style={{ ['--gap' as string]: '16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ ['--gap' as string]: '2px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{slot.offer.name}</h2>
          <span className="small muted">{slot.dayLabel}</span>
        </div>
        <Link className="btn btn-sm" href={back}>Fermer</Link>
      </div>
      <p className="small" style={{ color: 'var(--ink-2)' }}>
        <b>{slot.bookings}</b> réservation{slot.bookings > 1 ? 's' : ''} · {slot.used} / {slot.capacity} {slot.offer.capacityUnit === 'places' ? 'places' : 'salles'} prises
        {!slot.isOpen && <span className="pill pill-muted" style={{ marginLeft: 8 }}>fermé</span>}
      </p>
      <form action={action} className="stack" style={{ ['--gap' as string]: '16px' }}>
        <input type="hidden" name="slotId" value={slot.id} />
        <label className="field" style={{ maxWidth: 200 }}>
          <span>Heure</span>
          <input className="input" type="time" name="time" step={300} defaultValue={slot.time} disabled={locked} />
          {locked && <span className="hint">{slot.past ? 'Créneau passé.' : 'Des clients ont réservé : l’heure ne change plus.'}</span>}
        </label>
        <PricePicker offer={slot.offer} pct={pct} setPct={setPct} />
        <label className="field" style={{ maxWidth: 200 }}>
          <span>{slot.offer.capacityUnit === 'groupes' ? 'Salles ou pistes' : 'Places'}</span>
          <input className="input" type="number" name="capacity" min={Math.max(1, slot.used)} max={200} defaultValue={slot.capacity} required />
        </label>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.ok && <p className="notice notice-ok small" role="status">{state.message}</p>}
        <button className="btn btn-primary btn-block" disabled={pending || slot.past}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
      {!slot.past && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <form action={toggleSlotAction}>
            <input type="hidden" name="slotId" value={slot.id} />
            <button className="btn btn-sm">{slot.isOpen ? 'Fermer à la réservation' : 'Rouvrir'}</button>
          </form>
          {slot.bookings === 0 && (
            <form action={deleteSlotAction}>
              <input type="hidden" name="slotId" value={slot.id} />
              <input type="hidden" name="back" value={back} />
              <button className="btn btn-sm btn-danger">Supprimer</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
