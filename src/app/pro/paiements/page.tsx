import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, type Venue } from '@/db/schema';
import { paymentState, refreshAccount, type PaymentState } from '@/lib/connect';
import { euros } from '@/lib/format';
import { COMMISSION_PCT } from '@/lib/pricing';
import { CANCEL_HOURS } from '@/lib/bookings-rules';
import { connectEnabled, paymentsEnabled } from '@/lib/payments';
import { formatIban, isClosed, monthLabel, monthOf, PAYOUT_DAY, shiftMonth, venueStatement } from '@/lib/payouts';
import { requireOwnerContext } from '@/lib/pro';
import { connectAction, dashboardAction } from './actions';
import { IbanForm } from './IbanForm';

export const metadata = { title: 'Paiements' };

const dayFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' });

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ retour?: string; erreur?: string }> }) {
  const { current } = await requireOwnerContext('/pro/paiements');
  if (!current) redirect('/pro');
  const sp = await searchParams;
  const connect = connectEnabled();

  return (
    <>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 className="display" style={{ fontSize: 22 }}>Paiements</h1>
        <p className="muted">
          {connect
            ? 'Les clients paient en ligne au moment de réserver. L’argent arrive sur ton compte bancaire, commission d’Aubaine déduite.'
            : 'Les clients paient en ligne au moment de réserver. Aubaine te vire chaque mois le montant de tes activités, commission déduite.'}
        </p>
      </header>
      {sp.erreur === '1' && <p className="notice notice-deal" role="alert">Stripe n’a pas répondu. Réessaie dans un instant ; si ça continue, écris-nous.</p>}
      {connect ? <ConnectSection venue={current.venue} retour={sp.retour === '1'} /> : <TransferSection venue={current.venue} />}
    </>
  );
}

/* ---------- Mode par défaut : Aubaine encaisse et vire chaque mois ---------- */

async function TransferSection({ venue: v }: { venue: Venue }) {
  const statement = await venueStatement(v.id);
  const thisMonth = monthOf();
  const status = (month: string, paidAt: Date | null) =>
    paidAt
      ? { pill: 'pill-ok', text: `Viré le ${dayFmt.format(paidAt)}` }
      : isClosed(month)
        ? { pill: 'pill-amber', text: `Virement avant le ${PAYOUT_DAY} ${monthLabel(shiftMonth(month, 1)).split(' ')[0]}` }
        : { pill: 'pill-muted', text: month === thisMonth ? 'Mois en cours' : 'À venir' };

  return (
    <>
      {!paymentsEnabled() && (
        <p className="notice notice-amber">Phase de test : les paiements sont simulés et rien n’est encaissé. Tu peux déjà indiquer ton IBAN.</p>
      )}

      <section className="card stack" aria-labelledby="iban-title">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 id="iban-title" style={{ fontSize: 16, fontWeight: 800 }}>Compte pour tes virements</h2>
          <span className={`pill ${v.payoutIban ? 'pill-ok' : 'pill-amber'}`} data-testid="pay-state">{v.payoutIban ? 'Renseigné' : 'À renseigner'}</span>
        </div>
        <IbanForm holder={v.payoutHolder ?? v.legalName ?? ''} iban={v.payoutIban ? formatIban(v.payoutIban) : ''} />
      </section>

      <section className="card stack" aria-labelledby="statement-title">
        <h2 id="statement-title" style={{ fontSize: 16, fontWeight: 800 }}>Relevés</h2>
        {statement.length === 0 ? (
          <p className="muted small">Aucune réservation payée pour l’instant. Chaque mois apparaîtra ici avec le montant viré.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {statement.map((r, i) => {
              const s = status(r.month, r.payout?.paidAt ?? null);
              return (
                <li key={r.month} className="row" data-testid="statement-row" style={{ padding: '12px 0', borderTop: i ? '1px solid var(--line-2)' : 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <span className="grow stack" style={{ ['--gap' as string]: '4px', minWidth: 180 }}>
                    <b style={{ textTransform: 'capitalize' }}>{monthLabel(r.month)}</b>
                    <span className="small muted">
                      {r.count} réservation{r.count > 1 ? 's' : ''} · {euros(r.totalCents)} payés · −{euros(r.feeCents)} de commission
                    </span>
                  </span>
                  <span className="stack" style={{ ['--gap' as string]: '4px', alignItems: 'flex-end', marginLeft: 'auto' }}>
                    <b style={{ fontSize: 17 }}>{euros(r.amountCents)}</b>
                    <span className={`pill ${s.pill}`}>{s.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="pay-how">
        <h2 id="pay-how" style={{ fontSize: 15, fontWeight: 800 }}>Comment ça marche</h2>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', display: 'grid', gap: 6 }}>
          <li>Le client paie en ligne au moment de réserver : Bancontact, carte, Apple Pay ou Google Pay. Aubaine encaisse en ton nom.</li>
          <li>
            Avant le {PAYOUT_DAY} de chaque mois, Aubaine te vire le montant des activités du mois précédent, commission de {COMMISSION_PCT} % déduite. Tu reçois un email à chaque
            virement.
          </li>
          <li>Les frais bancaires sont payés par Aubaine : rien d’autre n’est retenu. Un client absent a quand même payé : tu reçois le montant.</li>
          <li>Si un client annule à temps (jusqu’à {CANCEL_HOURS} h avant) ou si tu annules, il est remboursé et rien n’est compté.</li>
        </ol>
        <p className="small muted">
          Détails dans les <Link href="/conditions-partenaires">conditions partenaires</Link>.
        </p>
      </section>
    </>
  );
}

/* ---------- Mode Stripe Connect (STRIPE_CONNECT=1) ---------- */

const PILL: Record<Exclude<PaymentState, 'off'>, [string, string]> = {
  none: ['pill-muted', 'Non activés'],
  incomplete: ['pill-amber', 'Inscription à terminer'],
  review: ['pill-amber', 'Vérification en cours'],
  ready: ['pill-ok', 'Activés'],
};

async function ConnectSection({ venue, retour }: { venue: Venue; retour: boolean }) {
  let v = venue;
  // Le webhook tient l'état à jour ; on relit aussi Stripe au retour du formulaire et tant que ce n'est pas prêt.
  const stale = !v.stripeCheckedAt || Date.now() - v.stripeCheckedAt.getTime() > 3_600_000;
  if (v.stripeAccountId && (retour || !v.stripeChargesEnabled || stale)) {
    try {
      v = { ...v, ...(await refreshAccount(v.stripeAccountId)) };
    } catch (e) {
      console.error('[stripe] état du compte', e);
    }
  }
  const state = paymentState(v);
  if (state === 'off') return null;

  const [month] = await db
    .select({
      total: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int`,
      fee: sql<number>`coalesce(sum(${bookings.feeCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.venueId, v.id),
        isNotNull(bookings.stripeAccountId),
        inArray(bookings.status, ['confirmed', 'checked_in', 'no_show']),
        sql`${bookings.paidAt} >= date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'`,
      ),
    );

  return (
    <>
      <section className="card stack" aria-labelledby="pay-state">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 id="pay-state" style={{ fontSize: 16, fontWeight: 800 }}>Encaissement en ligne</h2>
          <span className={`pill ${PILL[state][0]}`} data-testid="pay-state">{PILL[state][1]}</span>
        </div>

        {state === 'none' && (
          <>
            <p>
              Pour recevoir des réservations, relie ton compte bancaire. L’inscription se fait chez <b>Stripe</b>, notre prestataire de paiement, en 5 à 10 minutes. Prévois :
            </p>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>
              <li>ton numéro d’entreprise et l’adresse du siège ;</li>
              <li>la carte d’identité du gérant ;</li>
              <li>l’IBAN du compte qui recevra les virements.</li>
            </ul>
            <form action={connectAction}>
              <button className="btn btn-primary btn-block">Activer les paiements</button>
            </form>
            <p className="small muted">Stripe vérifie l’identité de chaque exploitant, comme l’impose la loi. Aubaine ne voit ni ta pièce d’identité ni ton IBAN.</p>
          </>
        )}

        {state === 'incomplete' && (
          <>
            <p>L’inscription chez Stripe n’est pas terminée. Tu reprends là où tu t’étais arrêté.</p>
            <a className="btn btn-primary btn-block" href="/pro/paiements/lien">Continuer sur Stripe</a>
          </>
        )}

        {state === 'review' && (
          <>
            <p>C’est envoyé. Stripe vérifie tes informations : en général quelques minutes, parfois un à deux jours. S’il manque un document, Stripe te l’écrit, et tu le complètes ici.</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Link className="btn" href="/pro/paiements?retour=1">Actualiser</Link>
              <a className="btn" href="/pro/paiements/lien">Compléter sur Stripe</a>
            </div>
          </>
        )}

        {state === 'ready' && (
          <>
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, ['--gap' as string]: '6px' }}>
              <li className="row" style={{ justifyContent: 'space-between' }}>
                <span>Carte, Apple Pay, Google Pay</span>
                <span className="pill pill-ok">Actifs</span>
              </li>
              <li className="row" style={{ justifyContent: 'space-between' }}>
                <span>Bancontact</span>
                <span className={`pill ${v.stripeBancontact ? 'pill-ok' : 'pill-amber'}`}>{v.stripeBancontact ? 'Actif' : 'En cours d’activation'}</span>
              </li>
              <li className="row" style={{ justifyContent: 'space-between' }}>
                <span>Virements sur ton compte</span>
                <span className={`pill ${v.stripePayoutsEnabled ? 'pill-ok' : 'pill-amber'}`}>{v.stripePayoutsEnabled ? 'Chaque lundi' : 'En attente'}</span>
              </li>
            </ul>
            {!v.stripePayoutsEnabled && (
              <p className="notice notice-amber">
                Les virements sont en attente : Stripe a besoin d’une information. <a href="/pro/paiements/lien">Compléter sur Stripe</a>
              </p>
            )}
            <form action={dashboardAction}>
              <button className="btn btn-block">Mon espace Stripe : virements, relevés, IBAN</button>
            </form>
          </>
        )}
      </section>

      {state !== 'none' && (
        <section className="kpis" aria-label="Ce mois-ci">
          <div className="kpi">
            <span>Payé par les clients ce mois</span>
            <b>{euros(month.total)}</b>
            <span className="small muted">{month.count} réservation{month.count > 1 ? 's' : ''}</span>
          </div>
          <div className="kpi">
            <span>Commission Aubaine</span>
            <b>{euros(month.fee)}</b>
            <span className="small muted">{COMMISSION_PCT} %</span>
          </div>
          <div className="kpi">
            <span>Pour toi</span>
            <b>{euros(month.total - month.fee)}</b>
            <span className="small muted">versé par Stripe</span>
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="pay-how">
        <h2 id="pay-how" style={{ fontSize: 15, fontWeight: 800 }}>Comment ça marche</h2>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', display: 'grid', gap: 6 }}>
          <li>Le client paie au moment de réserver : Bancontact, carte, Apple Pay ou Google Pay. Le paiement est fait à ton nom, c’est toi le vendeur.</li>
          <li>Aubaine prélève sa commission de {COMMISSION_PCT} % au passage. Les frais bancaires de Stripe sont payés par Aubaine : rien d’autre n’est retenu.</li>
          <li>Stripe vire le reste sur ton compte chaque lundi. Le tout premier virement peut prendre une semaine de plus, le temps des vérifications.</li>
          <li>
            Si un client annule (jusqu’à {CANCEL_HOURS} h avant) ou si tu annules, il est remboursé en entier et la commission t’est rendue. Le montant est repris sur ton solde Stripe ou sur
            le virement suivant.
          </li>
        </ol>
      </section>
    </>
  );
}
