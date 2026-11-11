import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { euros } from '@/lib/format';
import { connectEnabled } from '@/lib/payments';
import { dueForMonth, formatIban, isClosed, isMonth, monthLabel, monthOf, PAYOUT_DAY, payoutReference, shiftMonth } from '@/lib/payouts';
import { MarkPaidForm } from './MarkPaidForm';

export const metadata = { title: 'Virements' };

const dayFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' });

/** Virements mensuels aux exploitants : ce qu'Aubaine a encaissé pour eux, commission déduite */
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const current = monthOf();
  const month = isMonth(sp.mois) && sp.mois <= current ? sp.mois : shiftMonth(current, -1);
  const rows = await dueForMonth(month);
  const closed = isClosed(month);
  const toPay = rows.filter((r) => !r.payout);
  const sum = (list: typeof rows, k: 'amountCents' | 'feeCents' | 'totalCents') => list.reduce((s, r) => s + r[k], 0);
  const missingIban = toPay.filter((r) => !r.iban).length;

  return (
    <div className="admin-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Virements aux exploitants</h1>
          <p className="muted small">
            Activités de <b style={{ textTransform: 'capitalize' }}>{monthLabel(month)}</b>. À virer avant le {PAYOUT_DAY} du mois suivant, depuis le compte d’Aubaine.
          </p>
        </div>
        <nav className="row" aria-label="Mois" style={{ ['--gap' as string]: '8px' }}>
          <Link className="btn btn-sm" href={`/admin/virements?mois=${shiftMonth(month, -1)}`}>← {monthLabel(shiftMonth(month, -1)).split(' ')[0]}</Link>
          {month < current && (
            <Link className="btn btn-sm" href={`/admin/virements?mois=${shiftMonth(month, 1)}`}>
              {monthLabel(shiftMonth(month, 1)).split(' ')[0]} →
            </Link>
          )}
        </nav>
      </header>

      {connectEnabled() && <p className="notice notice-amber">Mode Stripe Connect actif : les nouveaux paiements sont versés par Stripe et n’apparaissent pas ici.</p>}

      <section className="kpis" aria-label="Totaux du mois">
        <div className="kpi">
          <span>{closed ? 'Reste à virer' : 'À virer (mois en cours)'}</span>
          <b>{euros(sum(toPay, 'amountCents'))}</b>
          <span className="small muted">{toPay.length} établissement{toPay.length > 1 ? 's' : ''}</span>
        </div>
        <div className="kpi">
          <span>Déjà viré</span>
          <b>{euros(sum(rows.filter((r) => r.payout), 'amountCents'))}</b>
          <span className="small muted">{rows.length - toPay.length} établissement{rows.length - toPay.length > 1 ? 's' : ''}</span>
        </div>
        <div className="kpi">
          <span>Commission Aubaine</span>
          <b>{euros(sum(rows, 'feeCents'))}</b>
          <span className="small muted">sur {euros(sum(rows, 'totalCents'))} encaissés</span>
        </div>
      </section>

      {missingIban > 0 && (
        <p className="notice notice-amber">
          {missingIban} établissement{missingIban > 1 ? 's n’ont' : ' n’a'} pas encore donné d’IBAN : demande-le, il le saisit dans son espace, page Paiements.
        </p>
      )}

      <section className="card stack" aria-label="Établissements">
        {rows.length === 0 ? (
          <p className="muted">Aucune réservation payée pour des activités de ce mois.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Établissement</th>
                  <th>Bénéficiaire</th>
                  <th style={{ textAlign: 'right' }}>Réserv.</th>
                  <th style={{ textAlign: 'right' }}>Encaissé</th>
                  <th style={{ textAlign: 'right' }}>Commission</th>
                  <th style={{ textAlign: 'right' }}>À virer</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.venueId} data-testid="payout-row">
                    <td>
                      <b>{r.name}</b>
                      <span className="small muted" style={{ display: 'block' }}>
                        {[r.legalName, r.companyNumber].filter(Boolean).join(', ') || 'Infos légales manquantes'}
                      </span>
                    </td>
                    <td>
                      {r.payout || r.iban ? (
                        <>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{formatIban(r.payout?.iban ?? r.iban ?? '')}</span>
                          <span className="small muted" style={{ display: 'block' }}>{r.payout?.holder ?? r.holder}</span>
                        </>
                      ) : (
                        <span className="pill pill-amber">IBAN manquant</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                    <td style={{ textAlign: 'right' }}>{euros(r.totalCents)}</td>
                    <td style={{ textAlign: 'right' }}>{euros(r.feeCents)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{euros(r.amountCents)}</td>
                    <td>
                      {r.payout ? (
                        <span className="pill pill-ok" title={r.payout.reference ?? undefined}>Viré le {dayFmt.format(r.payout.paidAt)}</span>
                      ) : !closed ? (
                        <span className="pill pill-muted">Mois en cours</span>
                      ) : r.iban ? (
                        <MarkPaidForm venueId={r.venueId} month={month} reference={payoutReference(month, r.name)} amount={euros(r.amountCents)} />
                      ) : (
                        <span className="small muted">En attente de l’IBAN</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack small" aria-label="Mode d’emploi" style={{ color: 'var(--ink-2)' }}>
        <b style={{ color: 'var(--ink)' }}>Chaque début de mois</b>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>
            Télécharge la liste (<a href={`/admin/virements/export?mois=${month}`}>export CSV</a>) : bénéficiaire, IBAN, montant et communication de chaque virement.
          </li>
          <li>Fais les virements depuis l’appli de ta banque (virement SEPA, gratuit en Belgique).</li>
          <li>Clique « Marquer comme versé » : les montants sont figés et l’exploitant reçoit un email avec son relevé.</li>
          <li>Facture ensuite ta commission à chaque exploitant (montant de la colonne Commission).</li>
        </ol>
      </section>
    </div>
  );
}
