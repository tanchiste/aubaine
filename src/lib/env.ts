import 'server-only';

/** Emails de l'équipe Aubaine qui ont accès au back-office (variable ADMIN_EMAILS, séparés par des virgules) */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (email: string) => adminEmails().includes(email.trim().toLowerCase());

/**
 * Phase de test (AUTH_DEV_CODES=1 en ligne, toujours en local) : les codes des clients et exploitants
 * s'affichent à l'écran et les emails ne partent que vers l'équipe Aubaine.
 */
export const testMode = () => process.env.NODE_ENV !== 'production' || process.env.AUTH_DEV_CODES === '1';

/**
 * Le code du back-office ne s'affiche jamais à l'écran en ligne : sinon n'importe qui
 * connaissant l'email admin pourrait l'ouvrir. ADMIN_DEV_CODES=1 sert uniquement aux tests locaux.
 */
/**
 * Clé back-office (ADMIN_KEY, au moins 12 caractères) : permet à l'équipe Aubaine de se connecter
 * sans service d'email. Elle remplace le code à 6 chiffres quand celui-ci ne peut ni s'afficher ni partir par email.
 */
export function adminKey(): string | null {
  const k = (process.env.ADMIN_KEY ?? '').trim();
  return k.length >= 12 ? k : null;
}

export const adminCodesOnScreen = () => process.env.NODE_ENV !== 'production' || process.env.ADMIN_DEV_CODES === '1';
