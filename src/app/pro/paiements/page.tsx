import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { paymentState, refreshAccount, type PaymentState } from '@/lib/connect';
import { euros } from '@/lib/format';
import { COMMISSION_PCT } from '@/lib/pricing';
import { CANCEL_HOURS } from '@/lib/bookings-rules';
import { requireOwnerContext } from '@/lib/pro';
import { connectAction, dashboardAction } from './actions';

export const metadata = { title: 'Paiements' };

const PILL: Record<Exclude<PaymentState, 'off'>, [string, string]> = {
  none: ['pill-muted', 'Non activés'],
  incomplete: ['pill-amber', 'Inscription à terminer'],
  review: ['pill-amber', 'Vérification en cours'],
  ready: ['pill-ok', 'Activés'],
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ retour?: string; erreur?: string }> }) {
  const { current } = await requireOwnerContext('/pro/paiements');
  if (!current) redirect('/pro');
  const sp = await searchParams;
  let v = current.venue;

  // Le webhook tient l'état à jour ; on relit aussi Stripe au retour du formulaire et tant que ce n'est pas prêt.
  const stale = !v.stripeCheckedAt || Date.now() - v.stripeCheckedAt.getTime() > 3_600_000;
  if (paymentState(v) !== 'off' && v.stripeAccountId && (sp.retour === '1' || !v.stripeChargesEnabled || stale)) {
    try {
      v = { ...v, ...(await refreshAccount(v.stripeAccountId)) };
    } catch (e) {
      console.error('[stripe] état du compte', e);
    }
  }
  const state = paymentState(v);

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
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 className="display" style={{ fontSize: 22 }}>Paiements</h1>
        <p className="muted">Les clients paient en ligne au moment de réserver. L’argent arrive sur ton compte bancaire, commission d’Aubaine déduite.</p>
      </header>

      {sp.erreur === '1' && <p className="notice notice-deal" role="alert">Stripe n’a pas répondu. Réessaie dans un instant ; si ça continue, écris-nous.</p>}

      {state === 'off' ? (
        <section className="card stack">
          <p className="notice notice-amber">Phase de test : les paiements sont simulés et rien n’est encaissé. Tu pourras relier ton compte bancaire ici dès l’ouverture des paiements.</p>
        </section>
      ) : (
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
              <p>
                C’est envoyé. Stripe vérifie tes informations : en général quelques minutes, parfois un à deux jours. S’il manque un document, Stripe te l’écrit, et tu le complètes ici.
              </p>
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
      )}

      {state !== 'off' && state !== 'none' && (
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
        <p className="small muted">
          Détails dans les <Link href="/conditions-partenaires">conditions partenaires</Link>.
        </p>
      </section>
    </>
  );
}
