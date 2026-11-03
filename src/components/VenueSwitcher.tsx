'use client';
import { switchVenueAction } from '@/app/pro/actions';

type Item = { id: string; name: string };

/** Changer d'établissement géré, quand l'exploitant en a plusieurs */
export function VenueSwitcher({ items, currentId, id = "venue-switch" }: { items: Item[]; currentId: string; id?: string }) {
  if (items.length < 2) return null;
  return (
    <form action={switchVenueAction}>
      <label className="sr-only" htmlFor={id}>Établissement</label>
      <select
        id={id}
        name="venueId"
        className="select"
        defaultValue={currentId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{ height: 40, background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
      >
        {items.map((i) => (
          <option key={i.id} value={i.id} style={{ color: '#17142E' }}>
            {i.name}
          </option>
        ))}
      </select>
    </form>
  );
}
