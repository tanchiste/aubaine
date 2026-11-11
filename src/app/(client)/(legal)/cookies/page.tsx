import Link from 'next/link';
import type { Metadata } from 'next';
import { DocHead } from '../bits';

export const metadata: Metadata = { title: 'Cookies', description: 'Les quelques cookies qu’Aubaine utilise, tous nécessaires au service.' };

const COOKIES: [string, string, string][] = [
  ['aub_session', 'Te garder connecté (identifiant de session chiffré)', '30 jours'],
  ['aub_ville', 'Retenir la ville choisie dans Explorer', '1 an'],
  ['aub_pos', 'Retenir ta position approximative pour « Autour de moi », si tu l’as partagée', '12 heures'],
  ['aub_venue', 'Espace exploitant : retenir l’établissement affiché', '1 an'],
];

export default function Cookies() {
  return (
    <>
      <DocHead title="Cookies">
        <p>
          <b>L’essentiel :</b> Aubaine n’utilise ni cookie publicitaire, ni outil de mesure d’audience, ni pixel de réseau social. Les seuls cookies servent au fonctionnement du service :
          c’est pour ça qu’il n’y a pas de bandeau à accepter.
        </p>
      </DocHead>

      <h2>Les cookies d’Aubaine</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>À quoi il sert</th>
              <th>Durée</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([n, use, d]) => (
              <tr key={n}>
                <td>
                  <code>{n}</code>
                </td>
                <td>{use}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Ces cookies sont strictement nécessaires au service que tu demandes : la loi belge et le RGPD les dispensent de consentement. Ils ne servent jamais à te suivre sur d’autres
        sites.
      </p>

      <h2>Pendant le paiement</h2>
      <p>
        Le paiement se fait sur la page sécurisée de Stripe, qui y dépose ses propres cookies pour sécuriser la transaction et prévenir la fraude. Ils sont décrits dans la{' '}
        <a href="https://stripe.com/fr-be/legal/cookies-policy" target="_blank" rel="noreferrer">politique cookies de Stripe</a>.
      </p>

      <h2>Les effacer</h2>
      <p>
        Tu peux supprimer ces cookies dans les réglages de ton navigateur. Tu seras alors déconnecté et Explorer reviendra à « Tout le Hainaut ». Pour ne plus partager ta position, choisis
        « Ne plus utiliser ma position » dans le menu des villes.
      </p>
      <p className="small muted">
        Plus de détails sur tes données dans la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </>
  );
}
