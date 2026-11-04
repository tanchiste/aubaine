import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, venueMembers } from '@/db/schema';
import { requireOwnerContext } from '@/lib/pro';
import { redirect } from 'next/navigation';
import { removeMemberAction, setRoleAction } from './actions';
import { InviteForm } from './InviteForm';

export const metadata = { title: 'Équipe' };

export default async function TeamPage() {
  const { user, current } = await requireOwnerContext('/pro/equipe');
  if (!current) redirect('/pro');
  const team = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: venueMembers.role, since: venueMembers.createdAt })
    .from(venueMembers)
    .innerJoin(users, eq(users.id, venueMembers.userId))
    .where(eq(venueMembers.venueId, current.venue.id))
    .orderBy(asc(venueMembers.createdAt));

  return (
    <>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 className="display" style={{ fontSize: 22 }}>Équipe</h1>
        <p className="muted">Les personnes qui gèrent {current.venue.name} avec toi.</p>
      </header>
      <section className="card" aria-label="Membres" style={{ padding: '4px 16px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {team.map((m, i) => (
            <li key={m.id} className="row" style={{ padding: '12px 0', borderTop: i ? '1px solid var(--line-2)' : 0, flexWrap: 'wrap' }}>
              <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', background: m.role === 'owner' ? 'var(--primary)' : 'var(--amber)', color: m.role === 'owner' ? '#fff' : 'var(--night)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                {(m.firstName ?? m.email).charAt(0).toUpperCase()}
              </span>
              <span className="grow">
                <b style={{ fontSize: 14 }}>{[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}{m.id === user.id ? ' (toi)' : ''}</b>
                <span className="small muted" style={{ display: 'block' }}>{m.email}</span>
              </span>
              <span className={`pill ${m.role === 'owner' ? 'pill-primary' : 'pill-amber'}`}>{m.role === 'owner' ? 'Gérant' : 'Accueil'}</span>
              {m.id !== user.id && (
                <span className="row" style={{ ['--gap' as string]: '6px' }}>
                  <form action={setRoleAction}>
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="role" value={m.role === 'owner' ? 'staff' : 'owner'} />
                    <button className="btn btn-sm">{m.role === 'owner' ? 'Passer à l’accueil' : 'Passer gérant'}</button>
                  </form>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="userId" value={m.id} />
                    <button className="btn btn-sm btn-danger">Retirer</button>
                  </form>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <InviteForm />
    </>
  );
}
