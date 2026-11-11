import { CANCEL_HOURS, HOLD_MINUTES } from './bookings-rules';
import { COMMISSION_PCT } from './pricing';

/**
 * Société qui exploite Aubaine : alimente les mentions légales, les conditions, les emails et le pied de page.
 * Une valeur vide s'affiche « à compléter » : à remplir avant l'ouverture au public.
 */
export const COMPANY = {
  brand: 'Aubaine',
  /** Raison sociale et forme juridique, ex. « HRML SRL » */
  legalName: '',
  /** Numéro d'entreprise BCE, ex. « 0123.456.789 » */
  companyNumber: '',
  /** Numéro de TVA s'il diffère (sinon BE + numéro d'entreprise) */
  vatNumber: '',
  /** Adresse du siège */
  address: '',
  /** Adresse de contact publique (clients, exploitants, signalements, données personnelles) */
  email: 'connect.aubaine@gmail.com',
  /** Facultatif */
  phone: '',
};

/** Date de la version en vigueur des conditions : à changer à chaque modification importante */
export const TERMS_VERSION = '2026-11-11';
/** Préavis avant une modification des conditions partenaires (règlement P2B : 15 jours minimum) */
export const PARTNER_NOTICE_DAYS = 15;
/** Virements d'Aubaine aux exploitants : une fois par mois, avant le 10, pour les activités du mois précédent */
export const PAYOUT = { frequency: 'mensuel', day: 10 };

export const RULES = { cancelHours: CANCEL_HOURS, holdMinutes: HOLD_MINUTES, commissionPct: COMMISSION_PCT };

/** Hébergement et sous-traitants (mentions légales et politique de confidentialité) */
export const PROVIDERS = [
  { name: 'Vercel Inc.', role: 'Hébergement du site', where: '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Serveurs utilisés : Paris (France)' },
  { name: 'Supabase Inc.', role: 'Base de données', where: 'San Francisco, États-Unis. Données stockées à Paris (France)' },
  { name: 'Stripe Payments Europe Ltd.', role: 'Paiements (Bancontact, carte, Apple Pay, Google Pay)', where: 'Dublin, Irlande' },
  { name: 'Service d’envoi d’emails', role: 'Codes de connexion, confirmations, rappels', where: 'Resend (États-Unis) ou serveur SMTP configuré par Aubaine' },
  { name: 'OpenStreetMap Foundation', role: 'Fonds de carte et recherche d’adresses', where: 'Royaume-Uni' },
];

/** Champ de la société : la valeur, ou « à compléter » tant qu'elle n'est pas renseignée */
export const field = (v: string) => v.trim() || '[à compléter]';
export const companyReady = () => !!(COMPANY.legalName && COMPANY.companyNumber && COMPANY.address && COMPANY.email);
export const contactEmail = () => COMPANY.email || process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] || '';

/** Ligne d'identification courte (pied de page, emails) */
export const companyLine = () =>
  COMPANY.legalName ? `${COMPANY.legalName}${COMPANY.companyNumber ? `, BCE ${COMPANY.companyNumber}` : ''}${COMPANY.address ? `, ${COMPANY.address}` : ''}` : 'Aubaine';

/**
 * Numéro d'entreprise belge (BCE) : 10 chiffres commençant par 0 ou 1, clé modulo 97.
 * Renvoie le format 0123.456.789, ou null s'il est invalide.
 */
export function normalizeCompanyNumber(input: string): string | null {
  const digits = input.replace(/^\s*BE/i, '').replace(/\D/g, '');
  const d = digits.length === 9 ? `0${digits}` : digits;
  if (!/^[01]\d{9}$/.test(d)) return null;
  const base = parseInt(d.slice(0, 8), 10);
  const check = parseInt(d.slice(8), 10);
  if (97 - (base % 97) !== check) return null;
  return `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`;
}
