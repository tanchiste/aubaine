import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Applique les migrations du dossier /drizzle. Lancé automatiquement avant chaque build sur Vercel.
async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://aubaine:aubaine@localhost:5432/aubaine';
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
  console.log('Migrations appliquées.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
