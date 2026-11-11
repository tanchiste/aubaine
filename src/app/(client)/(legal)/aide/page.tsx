import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, RULES } from '@/lib/legal';
import { DocHead, Fill } from '../bits';

export const metadata: Metadata = { title: 'Aide et contact', description: 'Réserver, annuler, être remboursé, contacter Aubaine.' };

const FAQ: [string, React.ReactNode][] = [
  [
    'Comment fonctionne Aubaine ?',
    <>Les lieux de loisirs du Hainaut proposent leurs heures creuses à prix réduit. Tu choisis un créneau, tu paies en ligne, tu donnes ton code à l’accueil. C’est tout.</>,
  ],
  [
    'Le prix affiché est-il le prix final ?',
    <>Oui : TVA comprise, sans frais ajoutés par Aubaine. Le prix barré est le tarif habituel du lieu.</>,
  ],
  [
    'Comment annuler ?',
    <>
      Ouvre ton billet dans l’onglet <Link href="/billets">Billets</Link> et touche « Annuler ». C’est gratuit jusqu’à {RULES.cancelHours} h avant le début.
    </>,
  ],
  [
    'Quand suis-je remboursé ?',
    <>Le remboursement part tout de suite. Il arrive en général sous 5 jours ouvrables ; pour Bancontact, 2 à 5 jours, parfois sans la mention « remboursement » sur ton relevé.</>,
  ],
  [
    'Je suis en retard, que faire ?',
    <>Préviens le lieu directement (son adresse est sur ton billet). Passé l’heure de début, il n’est pas obligé de t’accepter et la réservation n’est pas remboursée.</>,
  ],
  [
    'Le lieu a annulé ma réservation',
    <>Tu as reçu un email avec le motif, et tu es remboursé en entier automatiquement. Rien à faire de ton côté.</>,
  ],
  [
    'Je n’ai pas reçu mon code de connexion',
    <>Regarde dans tes spams et promotions. Le code est valable 10 minutes ; tu peux en redemander un depuis l’écran du code.</>,
  ],
  [
    'Je gère un lieu de loisirs : comment rejoindre Aubaine ?',
    <>
      <Link href="/inscription?type=exploitant">Inscris ton établissement</Link> : tu crées ta fiche, on la vérifie sous 24 h, et tu ouvres tes créneaux. Les règles sont dans les{' '}
      <Link href="/conditions-partenaires">conditions partenaires</Link>.
    </>,
  ],
];

export default function Help() {
  return (
    <>
      <DocHead title="Aide et contact" />

      <div className="legal-faq">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>

      <h2>Nous écrire</h2>
      <p>
        {COMPANY.email ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : <Fill v="" />}
        {COMPANY.phone && <>, {COMPANY.phone}</>}. On répond sous 2 jours ouvrables. Pour une réservation, indique ton code à 6 caractères.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Une fiche, une photo ou un prix te semble illégal ou trompeur ? <Link href="/signaler">Signale-le ici</Link>.
      </p>
    </>
  );
}
