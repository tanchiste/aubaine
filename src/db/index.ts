import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://aubaine:aubaine@localhost:5432/aubaine';

// Une seule connexion réutilisée, même quand Next recharge les modules en développement.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

// prepare: false est requis par le pooler de Supabase (mode transaction, port 6543).
const client = globalForDb.pg ?? postgres(url, { prepare: false, max: 5, debug: process.env.DB_DEBUG ? (_c, q) => console.log('[sql]', q.replace(/\s+/g, ' ').slice(0, 90)) : undefined });
if (process.env.NODE_ENV !== 'production') globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
