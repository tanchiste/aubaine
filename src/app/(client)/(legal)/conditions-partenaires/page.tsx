import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, PARTNER_NOTICE_DAYS, PAYOUT, RULES } from '@/lib/legal';
import { MAX_DISCOUNT, MIN_DISCOUNT } from '@/lib/pricing';
import { DocHead, Fill } from '../bits';

export const metadata: Metadata = {
  title: 'Conditions partenaires',
  description: 'Les règles entre Aubaine et les exploitants : fiche, prix, encaissement, commission, classement et résiliation.',
};

export default function PartnerTerms() {
  return (
    <>
      <DocHead title="Conditions partenaires">
        <p>
          <b>L’essentiel :</b> vous vendez vos heures creuses sur Aubaine, à la remise que vous choisissez. Les clients vous paient en ligne, via votre compte Stripe, et vous recevez
          chaque semaine le montant moins une commission de {RULES.commissionPct} %. Pas d’abonnement, pas de frais d’entrée, frais bancaires de Stripe compris. Vous pouvez mettre votre fiche
          en pause ou arrêter quand vous voulez.
        </p>
      </DocHead>

      <h2>1. Parties et objet</h2>
      <p>
        Ces conditions lient <Fill v={COMPANY.legalName} />, numéro d’entreprise <Fill v={COMPANY.companyNumber} />, <Fill v={COMPANY.address} /> (« Aubaine »), et le professionnel qui
        inscrit un établissement de loisirs (« l’exploitant »). Elles organisent la mise en ligne de ses créneaux en heures creuses et leur réservation par des clients. Elles sont acceptées à
        l’inscription de l’établissement et s’appliquent conformément au règlement (UE) 2019/1150 promouvant l’équité et la transparence pour les entreprises utilisatrices de services
        d’intermédiation en ligne.
      </p>

      <h2>2. Inscription et fiche</h2>
      <ul>
        <li>L’exploitant est un professionnel inscrit à la Banque-Carrefour des Entreprises. Il indique son nom légal et son numéro d’entreprise, qui sont affichés aux clients.</li>
        <li>Il garantit que les informations de sa fiche (adresse, description, photos, durées, tailles de groupe, conditions d’accès) sont exactes et à jour.</li>
        <li>Aubaine vérifie chaque fiche avant sa mise en ligne et peut demander des corrections, en expliquant pourquoi.</li>
        <li>Le gérant peut inviter des membres de son équipe ; il répond de leurs actions dans l’espace exploitant.</li>
      </ul>

      <h2>3. Prix et remises</h2>
      <ul>
        <li>L’exploitant fixe le prix normal de chaque prestation, TVA comprise. Ce prix est son tarif public réellement pratiqué pour la même prestation, en dehors d’Aubaine.</li>
        <li>Il choisit pour chaque créneau une remise entre {MIN_DISCOUNT} et {MAX_DISCOUNT} %. Le client paie le prix remisé, sans frais ajoutés.</li>
        <li>Un prix normal gonflé pour afficher une remise plus forte est interdit : c’est une pratique commerciale trompeuse, et un motif de suspension.</li>
      </ul>

      <h2>4. Créneaux et réservations</h2>
      <ul>
        <li>L’exploitant ouvre et ferme ses créneaux librement. Fermer un créneau arrête les ventes ; les réservations déjà prises restent valables.</li>
        <li>Il honore toute réservation confirmée, aux conditions affichées au moment de la réservation, et valide l’arrivée du client avec son code.</li>
        <li>
          Le client peut annuler gratuitement jusqu’à {RULES.cancelHours} h avant le début ; il est alors remboursé et aucune commission n’est due. Passé ce délai ou en cas d’absence, la
          réservation reste payée.
        </li>
      </ul>

      <h2>5. Annulation par l’exploitant</h2>
      <p>
        L’exploitant ne peut annuler une réservation que pour un motif sérieux (panne, fermeture imprévue, sécurité, force majeure), depuis son planning, en indiquant le motif. Le client est
        remboursé en entier et prévenu par email ; aucune commission n’est due. Des annulations répétées sans motif sérieux peuvent entraîner une suspension.
      </p>

      <h2>6. Paiement, versements et commission</h2>
      <ul>
        <li>
          Pour recevoir des réservations, l’exploitant ouvre un compte de paiement chez Stripe (Stripe Payments Europe Ltd.) depuis son espace, page Paiements, et accepte à cette occasion
          le{' '}
          <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noreferrer">
            contrat de compte connecté Stripe
          </a>
          . Stripe vérifie son identité et son entreprise, comme la loi l’impose ; Aubaine n’a pas accès à ses pièces ni à son IBAN.
        </li>
        <li>
          Le client paie en ligne (Bancontact, carte, Apple Pay, Google Pay) au nom de l’exploitant, qui est le vendeur de l’activité. Le montant est crédité sur son compte Stripe : Aubaine ne
          détient jamais les fonds des clients.
        </li>
        <li>
          Stripe vire le solde disponible sur le compte bancaire de l’exploitant selon un rythme {PAYOUT.frequency}, le {PAYOUT.day}. Le premier virement peut prendre quelques jours de plus. Les
          virements et relevés sont consultables dans l’espace Stripe de l’exploitant.
        </li>
        <li>
          La commission d’Aubaine est de <b>{RULES.commissionPct} % du montant payé par le client</b> (TVA en sus le cas échéant). Elle est prélevée automatiquement au moment du paiement et
          récapitulée chaque mois sur une facture. Les frais de traitement de Stripe sont à la charge d’Aubaine.
        </li>
        <li>
          En cas d’annulation remboursée (par le client dans les délais, ou par l’exploitant), le client est remboursé en entier : le montant est repris sur le solde Stripe de l’exploitant et
          la commission lui est rendue. Si le solde ne suffit pas, la somme est déduite des virements suivants.
        </li>
        <li>Aucun abonnement ni frais d’inscription. Toute évolution du tarif suit l’article 11.</li>
      </ul>

      <h2>7. Classement des offres</h2>
      <p>
        Les offres sont classées par défaut selon la remise la plus forte, puis par ordre alphabétique. Quand le client partage sa position, le classement suit la distance. Le client peut aussi
        trier par heure ou par prix, et filtrer par ville, activité, date et taille de groupe. La rubrique « Les meilleures remises » montre le meilleur créneau de chaque lieu sur 7 jours.{' '}
        <b>Aucun emplacement n’est payant</b> et aucun exploitant n’est favorisé par un lien avec Aubaine.
      </p>

      <h2>8. Contenus</h2>
      <p>
        L’exploitant garantit détenir les droits sur les textes et photos qu’il publie, et autorise Aubaine à les afficher et à les utiliser pour faire connaître sa fiche, pendant la durée de
        sa présence sur Aubaine. Aubaine peut retirer un contenu illégal, trompeur ou contraire à ces conditions, notamment après un signalement ; elle en informe l’exploitant avec les motifs
        de sa décision, qu’il peut contester en répondant à l’email.
      </p>

      <h2>9. Données des clients</h2>
      <p>
        L’exploitant reçoit le prénom du client, le nombre de personnes, le créneau et le code de réservation. Il les utilise uniquement pour accueillir le client et ne les utilise pas à des fins
        commerciales sans son accord. Chaque partie est responsable de ses propres traitements au sens du RGPD.
      </p>

      <h2>10. Suspension et fin de la collaboration</h2>
      <ul>
        <li>L’exploitant peut mettre sa fiche en pause à tout moment, ou demander sa suppression. Les réservations déjà confirmées restent à honorer.</li>
        <li>
          Aubaine peut suspendre une fiche en cas de manquement à ces conditions (informations fausses, remises trompeuses, réservations non honorées, contenus illégaux). Elle en donne les
          motifs par écrit au plus tard au moment où la suspension prend effet.
        </li>
        <li>Aubaine peut mettre fin à la collaboration avec un préavis de 30 jours, ou sans préavis en cas de manquement grave, en motivant sa décision.</li>
      </ul>

      <h2>11. Modification des conditions</h2>
      <p>
        Toute modification est annoncée par email au moins {PARTNER_NOTICE_DAYS} jours avant son entrée en vigueur. L’exploitant qui ne l’accepte pas peut mettre fin à la collaboration avant
        cette date, sans frais.
      </p>

      <h2>12. Responsabilité</h2>
      <p>
        L’exploitant est seul responsable de son activité : sécurité, assurance responsabilité civile, autorisations, respect des règles d’hygiène et d’accueil. Aubaine fait le nécessaire pour
        que la plateforme fonctionne sans interruption, sans pouvoir le garantir en permanence, et répond de ses propres fautes.
      </p>

      <h2>13. Réclamations et litiges</h2>
      <p>
        Toute réclamation s’adresse à {COMPANY.email ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : <Fill v="" />}. Aubaine accuse réception et répond par écrit sous 10 jours
        ouvrables. Ces conditions relèvent du droit belge ; à défaut d’accord, les tribunaux de l’arrondissement du siège d’Aubaine sont compétents.
      </p>
      <p className="small muted">
        Voir aussi les <Link href="/conditions">conditions d’utilisation et de réservation</Link> applicables aux clients.
      </p>
    </>
  );
}
