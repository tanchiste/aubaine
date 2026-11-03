# Aubaine

Les loisirs du Hainaut à prix creux. Une app web pour trois publics :

- **les clients** (`/`) : trouver un créneau creux, réserver, montrer son billet ;
- **les exploitants** (`/pro`) : inscrire leur établissement, gérer fiche, photos, créneaux et arrivées ;
- **l'équipe Aubaine** (`/admin`) : valider les fiches avant leur mise en ligne.

## Où en est le projet

| Étape | Contenu | État |
|---|---|---|
| 1 | Connexion par code email, rôles, fiche exploitant + photos, validation admin, Explorer et fiche activité | ✅ fait |
| 2 | Créneaux côté exploitant, réservation (paiement simulé), billet avec code, validation à l'accueil | ✅ fait |
| 3 | Remise automatique, points de fidélité, parrainage, favoris et alertes | à faire |
| 4 | Paiement réel avec Stripe Connect (Bancontact, Apple Pay, carte) et virements aux exploitants | à faire |

## Outils

- **Next.js 16** (App Router, Server Actions) en TypeScript
- **PostgreSQL** via **Drizzle ORM** (hébergé chez Supabase en production)
- Connexion sans mot de passe : code à 6 chiffres envoyé par email (**Resend**)
- Photos réduites dans le navigateur (1600 px, WebP) puis stockées en base
- Hébergement **Vercel**

## Lancer en local

Il faut Node 20+ et PostgreSQL.

```bash
npm install
cp .env.example .env.local        # puis adapter DATABASE_URL et ADMIN_EMAILS
npm run db:migrate                # crée les tables
npm run db:seed                   # établissements de démonstration (fictifs)
npm run dev                       # http://localhost:3000
```

Sans `RESEND_API_KEY`, le code de connexion s'affiche à l'écran et dans la console : pratique pour développer. En ligne, ce mode de test s'active avec `AUTH_DEV_CODES=1` (n'importe qui peut alors se connecter avec n'importe quel email : à réserver à une adresse non partagée).

Comptes utiles en local :
- n'importe quel email pour un client ;
- l'email mis dans `ADMIN_EMAILS` ouvre `/admin` ;
- `demo.exploitant@aubaine.test` gère Kart'Ohm (données de démo).

## Mettre en ligne (Supabase + Vercel)

1. **Supabase** : créer le projet (région Frankfurt). Dans *Connect*, copier l'URL du **Transaction pooler** (port 6543) en remplaçant `[YOUR-PASSWORD]`.
2. **Vercel** : *Add New Project*, importer le dépôt GitHub `aubaine`.
3. Dans *Settings > Environment Variables*, ajouter :
   - `DATABASE_URL` : l'URL Supabase de l'étape 1
   - `AUTH_SECRET` : une longue chaîne aléatoire (`openssl rand -hex 32`)
   - `ADMIN_EMAILS` : ton email
   - `RESEND_API_KEY` et `EMAIL_FROM` : depuis resend.com (sans domaine vérifié, Resend n'envoie qu'à ton propre email)
   - `APP_URL` : l'adresse du site, par exemple `https://aubaine.vercel.app`
   - `SEED_DEMO` : `1` pour charger les établissements de démo à chaque déploiement (à retirer avant le lancement)
4. Déployer. Le script `vercel-build` applique les migrations de base de données avant chaque build.

Ne jamais coller ces valeurs dans un chat ni dans le code : elles vont uniquement dans Vercel.

## Tests

```bash
npm run build
AUTH_DEV_CODES=1 npm start          # dans un terminal
npm run test:e2e                    # dans un autre
```

Le test déroule le parcours complet : un exploitant crée sa fiche et ses photos, l'admin la valide, l'exploitant ouvre un créneau, un client réserve et reçoit son billet, l'exploitant valide l'arrivée avec le code, et le back-office reste fermé aux non-admins.

## Organisation du code

```
src/
  app/
    (client)/        Explorer, fiche activité, réservation, billets, profil
    connexion/       connexion par code
    pro/             espace exploitant
    admin/           back-office
    api/photos/      photos des fiches
  components/        éléments d'interface partagés
  db/schema.ts       toutes les tables
  lib/               connexion, prix, dates, requêtes
scripts/             migrations et données de démo
drizzle/             migrations SQL générées
tests/               test de bout en bout
```

Pour modifier la base : changer `src/db/schema.ts`, puis `npm run db:generate` pour créer la migration.
