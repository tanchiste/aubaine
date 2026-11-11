import Link from 'next/link';
import type { Metadata } from 'next';
import { COMPANY, PROVIDERS } from '@/lib/legal';
import { DocHead, Fill } from '../bits';

export const metadata: Metadata = { title: 'Mentions légales', description: 'Qui édite Aubaine, hébergement, propriété intellectuelle et contact.' };

export default function LegalNotice() {
  const vat = COMPANY.vatNumber || (COMPANY.companyNumber ? `BE ${COMPANY.companyNumber}` : '');
  return (
    <>
      <DocHead title="Mentions légales" />

      <h2>Éditeur</h2>
      <p>
        Aubaine est un service édité par <b><Fill v={COMPANY.legalName} /></b>, dont le siège est situé <Fill v={COMPANY.address} />.
      </p>
      <ul>
        <li>Numéro d’entreprise (BCE) : <Fill v={COMPANY.companyNumber} /></li>
        <li>Numéro de TVA : <Fill v={vat} /></li>
        <li>
          Contact : {COMPANY.email ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : <Fill v="" />}
          {COMPANY.phone && <>, {COMPANY.phone}</>}
        </li>
      </ul>

      <h2>Ce que fait Aubaine</h2>
      <p>
        Aubaine est une plateforme de réservation qui met en relation des particuliers et des exploitants de loisirs (karting, escape game, bowling, bien-être…) pour leurs heures creuses. Les
        activités sont fournies par les exploitants, identifiés sur chaque fiche. Aubaine prend la réservation en leur nom ; le paiement leur est versé par notre prestataire Stripe, commission d’Aubaine déduite. Le détail figure dans les{' '}
        <Link href="/conditions">conditions d’utilisation et de réservation</Link> et les <Link href="/conditions-partenaires">conditions partenaires</Link>.
      </p>

      <h2>Hébergement</h2>
      <ul>
        {PROVIDERS.slice(0, 2).map((p) => (
          <li key={p.name}>
            <b>{p.name}</b>, {p.role.toLowerCase()} : {p.where}.
          </li>
        ))}
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Aubaine, son logo, ses textes et son interface appartiennent à son éditeur. Les photos et descriptions des fiches appartiennent aux exploitants, qui autorisent Aubaine à les
        afficher. Fonds de carte © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, sous licence ODbL.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Une fiche, une photo ou un prix te semble illégal ou trompeur ? <Link href="/signaler">Signale-le</Link> : chaque signalement est examiné et tu reçois la décision motivée. C’est aussi le
        point de contact d’Aubaine pour les autorités et les utilisateurs au sens du règlement européen sur les services numériques (règlement (UE) 2022/2065). Langues acceptées : français et
        anglais.
      </p>

      <h2>Litiges</h2>
      <p>
        Les présentes mentions et l’utilisation d’Aubaine sont régies par le droit belge. En cas de différend, écris-nous d’abord : on cherche une solution à l’amiable. Les consommateurs
        peuvent aussi s’adresser gratuitement au{' '}
        <a href="https://mediationconsommateur.be" target="_blank" rel="noreferrer">Service de Médiation pour le Consommateur</a> (North Gate II, boulevard du Roi Albert II 8 boîte 1, 1000
        Bruxelles).
      </p>
    </>
  );
}
