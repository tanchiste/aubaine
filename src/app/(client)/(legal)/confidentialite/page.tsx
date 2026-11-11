import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, PROVIDERS } from '@/lib/legal';
import { DocHead, Fill } from '../bits';

export const metadata: Metadata = {
  title: 'Confidentialité',
  description: 'Les données qu’Aubaine utilise, pourquoi, combien de temps, et tes droits.',
};

const ROWS: [string, string, string, string][] = [
  ['Email, prénom ; nom, téléphone et ville si tu les ajoutes', 'Ton compte et ta connexion', 'Contrat', 'Tant que ton compte existe'],
  ['Réservations : lieu, créneau, nombre de personnes, montant, code', 'Ta réservation, ton billet, le rappel de la veille, l’accueil chez l’exploitant', 'Contrat', '7 ans (obligation comptable), sans lien avec toi si tu supprimes ton compte'],
  ['Paiement : moyen utilisé et références Stripe (jamais ton numéro de carte)', 'Encaisser, rembourser, lutter contre la fraude', 'Contrat et obligation légale', '7 ans (obligation comptable)'],
  ['Codes de connexion (enregistrés sous forme chiffrée)', 'Vérifier que l’email est bien à toi', 'Contrat', '10 minutes de validité'],
  ['Position approximative (arrondie à ~100 m)', '« Autour de moi » : distances et carte', 'Ton accord, donné dans le navigateur', '12 h, dans ton navigateur uniquement'],
  ['Signalements : email et message', 'Traiter le signalement et te répondre', 'Obligation légale (règlement sur les services numériques)', '1 an après la décision'],
  ['Journaux techniques : adresse IP, navigateur', 'Sécurité et bon fonctionnement', 'Intérêt légitime', '30 jours au plus'],
];

export default function Privacy() {
  return (
    <>
      <DocHead title="Politique de confidentialité">
        <p>
          <b>L’essentiel :</b> on utilise le minimum pour que tu puisses réserver. Pas de publicité, pas de revente de données, pas d’outil de mesure d’audience. L’exploitant ne reçoit que
          ton prénom, ton nombre de personnes et ton code. Tu peux télécharger tes données ou supprimer ton compte depuis ton profil.
        </p>
      </DocHead>

      <h2>Responsable du traitement</h2>
      <p>
        <Fill v={COMPANY.legalName} />, numéro d’entreprise <Fill v={COMPANY.companyNumber} />, <Fill v={COMPANY.address} />. Pour toute question sur tes données :{' '}
        {COMPANY.email ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : <Fill v="" />}.
      </p>

      <h2>Ce que nous utilisons, et pourquoi</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Données</th>
              <th>Pour quoi faire</th>
              <th>Base légale</th>
              <th>Durée</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([a, b, c, d]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
                <td>{c}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Pour les exploitants, nous utilisons aussi les informations de l’établissement et de l’équipe (nom, email, rôle, nom légal, numéro d’entreprise) pour exécuter les{' '}
        <Link href="/conditions-partenaires">conditions partenaires</Link>. Pour les virements mensuels, nous utilisons aussi le titulaire et l’IBAN du compte indiqué par l’exploitant : ils
        sont conservés tant qu’il est partenaire, et 7 ans dans les pièces comptables des virements faits.
      </p>

      <h2>Les emails que tu reçois</h2>
      <p>
        Uniquement des emails liés à ce que tu fais sur Aubaine : code de connexion, confirmation, rappel la veille, annulation et remboursement. Aucun email publicitaire. Si un jour nous en
        proposons, ce sera avec ton accord explicite.
      </p>

      <h2>Qui reçoit tes données</h2>
      <ul>
        <li>
          <b>L’exploitant</b> chez qui tu réserves : ton prénom, le nombre de personnes, le créneau et ton code. Ni ton email, ni ton téléphone.
        </li>
        <li>
          <b>Nos prestataires</b>, qui traitent les données pour nous et selon nos instructions :
          <ul>
            {PROVIDERS.map((p) => (
              <li key={p.name}>
                {p.name} : {p.role.toLowerCase()} ({p.where}).
              </li>
            ))}
          </ul>
        </li>
        <li>Les autorités, uniquement si la loi l’impose.</li>
      </ul>
      <p>
        Tes données sont stockées dans l’Union européenne (Paris). Certains prestataires sont des sociétés américaines : les transferts éventuels sont encadrés par le cadre de protection des
        données UE-États-Unis ou par les clauses contractuelles types de la Commission européenne. Les fonds de carte viennent des serveurs d’OpenStreetMap, qui reçoivent ton adresse IP pour
        afficher la carte (Royaume-Uni, pays reconnu comme protégeant les données de façon adéquate).
      </p>

      <h2>Tes droits</h2>
      <p>Tu peux à tout moment :</p>
      <ul>
        <li>accéder à tes données et en recevoir une copie : bouton « Télécharger mes données » dans ton <Link href="/profil">profil</Link> ;</li>
        <li>les corriger, depuis ton profil ;</li>
        <li>supprimer ton compte, depuis ton profil : tes données personnelles sont effacées, seules les réservations restent sous forme anonyme pour la comptabilité ;</li>
        <li>t’opposer à un traitement, en limiter l’usage, ou retirer ton accord pour la position (dans le menu des villes ou les réglages de ton navigateur).</li>
      </ul>
      <p>
        Pour toute autre demande, écris-nous : on répond sous un mois au plus. Tu peux aussi introduire une réclamation auprès de l’
        <a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noreferrer">Autorité de protection des données</a> (rue de la Presse 35, 1000 Bruxelles).
      </p>

      <h2>Sécurité</h2>
      <p>
        Connexion chiffrée (HTTPS) partout, pas de mot de passe à voler, codes de connexion et sessions enregistrés sous forme chiffrée, accès à la base réservé à l’équipe technique, paiements
        traités par Stripe (certifié PCI DSS).
      </p>

      <h2>Cookies</h2>
      <p>
        Aubaine n’utilise que des cookies nécessaires à son fonctionnement : le détail est sur la page <Link href="/cookies">cookies</Link>.
      </p>

      <h2>Modifications</h2>
      <p>Si cette politique change de façon importante, nous te prévenons par email avant que le changement s’applique.</p>
    </>
  );
}
