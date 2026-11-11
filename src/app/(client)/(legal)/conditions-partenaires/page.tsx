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
          <b>L’essentiel :</b> vous vendez vos heures creuses sur Aubaine, à la remise que vous choisissez. Aubaine encaisse pour vous et vous vire chaque mois les montants des activités
          réalisées, moins une commission de {RULES.commissionPct} %. Pas d’abonnement, pas de frais d’entrée, frais bancaires compris. Vous pouvez mettre votre fiche en pause ou arrêter quand
          vous voulez.
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

      {/* Mode par défaut (Aubaine encaisse puis vire). Si STRIPE_CONNECT=1 est activé un jour, ce texte doit changer (voir le commit 5f1a96b). */}
      <h2>6. Encaissement, virements et commission</h2>
      <ul>
        <li>
          L’exploitant donne mandat à Aubaine de conclure les réservations et d’encaisser le paiement des clients <b>en son nom et pour son compte</b>. Aubaine agit uniquement pour le
          compte de l’exploitant, jamais pour celui du client. Le client paie en ligne (Bancontact, carte, Apple Pay, Google Pay) par l’intermédiaire du prestataire de paiement d’Aubaine,
          Stripe.
        </li>
        <li>
          Virement {PAYOUT.frequency} : avant le {PAYOUT.day} de chaque mois, Aubaine vire à l’exploitant le montant des activités réalisées le mois précédent, commission déduite, sur l’IBAN
          qu’il indique dans son espace (page Paiements). Un relevé détaillé est envoyé par email et reste consultable dans l’espace exploitant. Une réservation payée dont le client ne
          s’est pas présenté reste due à l’exploitant.
        </li>
        <li>
          La commission d’Aubaine est de <b>{RULES.commissionPct} % du montant payé par le client</b> (TVA en sus le cas échéant). Elle est déduite du virement et facturée chaque mois. Elle
          n’est pas due sur une réservation annulée et remboursée. Les frais de paiement et de virement sont à la charge d’Aubaine.
        </li>
        <li>
          Avant le premier virement, Aubaine peut demander de quoi vérifier l’identité de l’exploitant et de son entreprise. Toute modification de l’IBAN est signalée par email à tous les
          gérants de l’établissement ; Aubaine peut retenir un virement le temps de vérifier un changement inhabituel.
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
