import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, RULES } from '@/lib/legal';
import { DocHead, Fill } from '../bits';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation et de réservation',
  description: 'Les règles d’Aubaine : compte, prix, paiement, annulation et remboursement.',
};

export default function Terms() {
  return (
    <>
      <DocHead title="Conditions d’utilisation et de réservation">
        <p>
          <b>L’essentiel :</b> tu réserves une activité chez un exploitant, Aubaine encaisse le paiement pour lui. Le prix affiché est le prix final, TVA comprise. Tu peux annuler gratuitement
          jusqu’à {RULES.cancelHours} h avant et tu es remboursé en entier. Si l’exploitant annule, tu es aussi remboursé en entier.
        </p>
      </DocHead>

      <h2>1. Qui sommes-nous</h2>
      <p>
        Aubaine est édité par <Fill v={COMPANY.legalName} />, numéro d’entreprise <Fill v={COMPANY.companyNumber} />, <Fill v={COMPANY.address} /> (« Aubaine », « nous »). Ces conditions
        s’appliquent à toute personne qui utilise Aubaine (« tu ») pour consulter des offres, créer un compte ou réserver. En créant un compte ou en payant une réservation, tu les acceptes.
      </p>

      <h2>2. Ce que fait Aubaine</h2>
      <p>
        Aubaine présente les créneaux que des exploitants de loisirs (« l’exploitant ») proposent à prix réduit, en dehors de leurs heures pleines. <b>L’activité est fournie par
        l’exploitant</b>, identifié sur sa fiche avec son nom légal et son numéro d’entreprise : c’est un professionnel, et le contrat de prestation est conclu entre toi et lui. Aubaine agit
        comme intermédiaire : nous prenons ta réservation, encaissons le paiement au nom et pour le compte de l’exploitant, t’envoyons ton billet et gérons l’annulation et le remboursement.
      </p>
      <p>
        Les résultats sont classés par défaut selon la remise la plus forte, ou selon la distance quand tu utilises « Autour de moi ». Tu peux aussi les trier par heure ou par prix. Aucun
        exploitant ne paie pour être mieux placé.
      </p>

      <h2>3. Ton compte</h2>
      <ul>
        <li>Pas de mot de passe : tu te connectes avec un code à 6 chiffres envoyé par email, valable 10 minutes.</li>
        <li>Un compte par personne, avec des informations exactes. Ton prénom est montré à l’accueil de l’exploitant.</li>
        <li>Tu dois avoir 18 ans, ou réserver avec l’accord d’un parent ou tuteur.</li>
        <li>
          Tu peux télécharger tes données ou supprimer ton compte à tout moment depuis ton <Link href="/profil">profil</Link>.
        </li>
      </ul>

      <h2>4. Prix</h2>
      <p>
        Les prix sont en euros, <b>TVA comprise</b>. Le prix barré (« prix normal ») est le tarif public habituel de l’exploitant pour la même prestation ; la remise heures creuses est
        appliquée dessus. Le total à payer s’affiche avant le paiement, sans frais ajoutés par Aubaine. Les éventuels suppléments sur place (location de matériel, boissons…) relèvent de
        l’exploitant.
      </p>

      <h2>5. Réservation et paiement</h2>
      <ol>
        <li>Tu choisis un créneau et le nombre de personnes, puis tu vérifies le récapitulatif.</li>
        <li>
          Tu paies par Bancontact, carte bancaire, Apple Pay ou Google Pay, sur la page sécurisée de notre prestataire Stripe. Tu paies Aubaine, qui encaisse au nom de l’exploitant :
          c’est Aubaine qui répond à tes questions de paiement et qui te rembourse en cas d’annulation. Aucun frais pour toi. Tes places sont gardées {RULES.holdMinutes} minutes pendant le
          paiement. Aubaine ne voit jamais ton numéro de carte.
        </li>
        <li>La réservation est conclue quand le paiement est confirmé. Tu reçois alors un email avec ton code, l’adresse, le détail du prix et un fichier pour ton agenda. Ton billet reste dans l’onglet Billets.</li>
        <li>À l’accueil, tu donnes ton code (ou montres ton billet). Respecte les conditions de l’exploitant indiquées sur sa fiche (âge minimum, tenue, ponctualité).</li>
      </ol>

      <h2>6. Pas de droit de rétractation, mais annulation gratuite</h2>
      <p>
        Les réservations d’activités de loisirs à une date précise ne donnent pas droit au délai de rétractation de 14 jours (article VI.53, 12° du Code de droit économique). En
        contrepartie, Aubaine te laisse <b>annuler gratuitement jusqu’à {RULES.cancelHours} h avant le début</b>, depuis ton billet. Tu es remboursé en entier sur le moyen de paiement utilisé :
        en général sous 5 jours ouvrables (Bancontact : 2 à 5 jours, la mention « remboursement » n’apparaît pas toujours).
      </p>
      <p>Moins de {RULES.cancelHours} h avant le début, en cas d’absence ou de retard qui empêche l’activité, la réservation reste due et n’est pas remboursée, sauf geste de l’exploitant.</p>

      <h2>7. Si l’exploitant annule</h2>
      <p>
        Panne, fermeture imprévue, raison de sécurité : si l’exploitant doit annuler, tu reçois un email avec le motif et tu es <b>remboursé en entier</b> automatiquement. Tu peux bien sûr
        réserver un autre créneau.
      </p>

      <h2>8. Points et parrainage</h2>
      <p>
        Les points (100 par sortie honorée) et le parrainage sont des avantages offerts par Aubaine. Ils n’ont pas de valeur en argent tant que leurs règles d’utilisation ne sont pas
        publiées, et ne peuvent pas être échangés contre de l’argent.
      </p>

      <h2>9. Responsabilités</h2>
      <p>
        Aubaine répond du bon fonctionnement de la réservation, du paiement et du remboursement. L’exploitant répond de l’activité elle-même : son déroulement, la sécurité, l’accueil et le
        respect des informations de sa fiche. Rien dans ces conditions ne limite les droits que la loi te garantit en tant que consommateur.
      </p>

      <h2>10. Bonne utilisation</h2>
      <p>
        Pas de réservations fictives, de revente de billets ni d’utilisation automatisée du site. En cas d’abus, nous pouvons suspendre un compte, en t’expliquant pourquoi. Un contenu te semble
        illégal ou trompeur ? <Link href="/signaler">Signale-le</Link>.
      </p>

      <h2>11. Données personnelles</h2>
      <p>
        Ce que nous faisons de tes données, et tes droits, sont expliqués dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>12. Une question, un problème</h2>
      <p>
        Écris-nous à {COMPANY.email ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : <Fill v="" />} : on répond sous 2 jours ouvrables. Si on ne trouve pas de solution
        ensemble, tu peux saisir gratuitement le <a href="https://mediationconsommateur.be" target="_blank" rel="noreferrer">Service de Médiation pour le Consommateur</a>. Ces conditions
        relèvent du droit belge ; en cas de litige, tu gardes la protection des règles de ton pays de résidence et le droit de saisir le tribunal de ton domicile.
      </p>

      <h2>13. Modifications</h2>
      <p>
        Nous pouvons faire évoluer ces conditions. La nouvelle version s’applique aux réservations faites après sa publication ; une réservation déjà payée reste régie par la version
        acceptée au moment du paiement. Pour un changement important, nous te prévenons par email.
      </p>
    </>
  );
}
