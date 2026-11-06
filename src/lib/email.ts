import 'server-only';
import nodemailer from 'nodemailer';
import type { Booking, Offer, Slot, Venue } from '@/db/schema';
import { isAdminEmail } from './env';
import { brusselsDate, capitalize, euros, longDate, timeLabel } from './format';
import { bookingIcs } from './ics';

type Attachment = { filename: string; content: string; contentType: string };
type Mail = { to: string; subject: string; text: string; html?: string; attachments?: Attachment[] };

/**
 * Peut-on écrire à n'importe quel client ?
 * Oui avec un serveur SMTP (Gmail, Brevo, OVH…) ou avec Resend et un domaine vérifié (EMAIL_FROM).
 * Avec Resend seul, l'expéditeur de test ne livre qu'au propriétaire du compte : on se limite à l'équipe Aubaine.
 */
export const canEmailEveryone = () => !!process.env.SMTP_URL || (!!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM);

/** Expéditeur affiché : EMAIL_FROM, sinon l'adresse du compte SMTP, sinon l'expéditeur de test de Resend */
function sender(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.SMTP_URL) {
    try {
      const user = decodeURIComponent(new URL(process.env.SMTP_URL).username);
      if (user.includes('@')) return `Aubaine <${user}>`;
    } catch {}
  }
  return 'Aubaine <onboarding@resend.dev>';
}

/**
 * Envoie un email par SMTP (SMTP_URL) ou par Resend (RESEND_API_KEY).
 * Sans service configuré, ou vers quelqu'un que l'expéditeur ne peut pas joindre, le contenu va dans les logs du serveur.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const smtp = process.env.SMTP_URL;
  const key = process.env.RESEND_API_KEY;
  if ((!smtp && !key) || (!canEmailEveryone() && !isAdminEmail(mail.to))) {
    console.log(`\n[email] à ${mail.to} · ${mail.subject}${mail.attachments?.length ? ` · ${mail.attachments.map((a) => a.filename).join(', ')}` : ''}\n${mail.text}\n`);
    return;
  }
  if (smtp) {
    await nodemailer.createTransport(smtp).sendMail({
      from: sender(),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType })),
    });
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: sender(),
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, content_type: a.contentType })),
    }),
  });
  if (!res.ok) {
    console.error('[email] échec Resend', res.status, await res.text().catch(() => ''));
    throw new Error("L'email n'a pas pu être envoyé.");
  }
}

export function loginCodeMail(to: string, code: string): Mail {
  return {
    to,
    subject: `${code} est ton code Aubaine`,
    text: `Ton code de connexion Aubaine : ${code}\n\nIl est valable 10 minutes. Si tu n'as rien demandé, ignore simplement cet email.`,
    html: `<div style="font-family:system-ui,sans-serif;color:#17142E;max-width:420px">
<p style="font-size:15px">Ton code de connexion Aubaine :</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:12px 0">${code}</p>
<p style="font-size:13px;color:#6B6882">Valable 10 minutes. Si tu n'as rien demandé, ignore simplement cet email.</p>
</div>`,
  };
}

/* ---------- Réservations ---------- */

type BookingRow = { booking: Booking; slot: Slot; venue: Venue; offer: Offer; user: { email: string; firstName: string | null } };

/** Les noms viennent des exploitants : jamais insérés tels quels dans du HTML */
const h = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const app = () => process.env.APP_URL ?? 'http://localhost:3000';

const METHOD_LABEL: Record<string, string> = { bancontact: 'Bancontact', card: 'carte bancaire', link: 'Link', simulé: 'paiement simulé (phase de test)' };
export const paymentLabel = (m: string | null) => (m ? (METHOD_LABEL[m] ?? m) : 'paiement en ligne');

/** Mise en page commune : sobre, lisible sans images, aux couleurs d'Aubaine */
function layout(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F2F1F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17142E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1F6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 14px;font-size:20px;font-weight:800;letter-spacing:-0.5px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:3px solid #3A28D4;vertical-align:-2px;margin-right:6px"></span>aubaine</td></tr>
<tr><td style="background:#fff;border-radius:18px;padding:24px 22px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 6px;font-size:12px;color:#6B6882;line-height:1.5">Aubaine, les loisirs du Hainaut aux heures creuses. Tu reçois cet email parce que tu as réservé sur Aubaine.</td></tr>
</table></td></tr></table></body></html>`;
}

function detailsRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px">${rows
    .map(([k, v]) => `<tr><td style="padding:7px 0;color:#6B6882;border-bottom:1px solid #EEEDF3">${k}</td><td align="right" style="padding:7px 0;font-weight:700;border-bottom:1px solid #EEEDF3">${v}</td></tr>`)
    .join('')}</table>`;
}

/** Confirmation envoyée dès que la réservation est payée (ou validée en paiement simulé), avec le billet en .ics */
export function bookingConfirmationMail(row: BookingRow): Mail {
  const { booking, slot, venue, offer, user } = row;
  const day = capitalize(longDate(brusselsDate(slot.startsAt)));
  const time = timeLabel(slot.startsAt);
  const ticket = `${app()}/billets/${booking.id}`;
  const where = venue.address ?? venue.city;
  const maps =
    venue.lat !== null && venue.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;
  const paid = booking.paymentMethod === 'simulé' ? 'Rien n’a été débité (phase de test).' : `Payé par ${paymentLabel(booking.paymentMethod)}.`;
  const hello = user.firstName ? `${user.firstName}, ` : '';
  const text = [
    `${hello}c'est réservé !`,
    '',
    `${venue.name} · ${offer.name}`,
    `${day} à ${time}, ${booking.people} pers.`,
    `Adresse : ${where}`,
    '',
    `Code à montrer à l'accueil : ${booking.code}`,
    `Total : ${euros(booking.totalCents)} au lieu de ${euros(booking.fullCents)} (−${booking.discountPct} %). ${paid}`,
    '',
    `Ton billet : ${ticket}`,
    `Itinéraire : ${maps}`,
    '',
    `Annulation gratuite jusqu'à 2 h avant, depuis ton billet${booking.paymentMethod && booking.paymentMethod !== 'simulé' ? ' : tu es remboursé sur ton moyen de paiement' : ''}.`,
  ].join('\n');
  const html = layout(
    `${h(hello)}c’est réservé !`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5"><b>${h(venue.name)}</b> t’attend <b>${h(day.toLowerCase())} à ${time}</b>.</p>
<div style="background:#17142E;color:#fff;border-radius:14px;padding:16px;text-align:center;margin:0 0 16px">
<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;opacity:.75">CODE À L’ACCUEIL</div>
<div style="font-size:30px;font-weight:800;letter-spacing:6px;margin-top:4px">${booking.code}</div></div>
${detailsRows([
  ['Activité', h(offer.name)],
  ['Quand', `${h(day)}, ${time}`],
  ['Groupe', `${booking.people} pers.`],
  ['Total', `${euros(booking.totalCents)} <s style="color:#8E8BA3;font-weight:400">${euros(booking.fullCents)}</s> <span style="color:#CF3520">−${booking.discountPct} %</span>`],
])}
<p style="margin:0 0 6px;font-size:14px;line-height:1.5">${h(where)}</p>
<p style="margin:0 0 18px;font-size:13px;color:#6B6882">${paid}</p>
<a href="${ticket}" style="display:block;background:#3A28D4;color:#fff;text-decoration:none;text-align:center;font-weight:700;border-radius:12px;padding:14px">Voir mon billet</a>
<a href="${maps}" style="display:block;color:#3A28D4;text-decoration:none;text-align:center;font-weight:700;padding:12px">Itinéraire</a>
<p style="margin:8px 0 0;font-size:13px;color:#6B6882;line-height:1.5">Annulation gratuite jusqu’à 2 h avant, depuis ton billet. Le fichier joint ajoute la séance à ton agenda.</p>`,
  );
  return {
    to: user.email,
    subject: `C’est réservé : ${venue.name}, ${day.toLowerCase()} à ${time}`,
    text,
    html,
    attachments: [{ filename: `aubaine-${booking.code}.ics`, content: Buffer.from(bookingIcs(row)).toString('base64'), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
  };
}

/** Annulation par le client, avec l'état du remboursement */
export function bookingCancelledMail(row: BookingRow, refunded: boolean): Mail {
  const { booking, slot, venue, user } = row;
  const day = capitalize(longDate(brusselsDate(slot.startsAt)));
  const time = timeLabel(slot.startsAt);
  const refund = refunded
    ? `${euros(booking.totalCents)} te sont remboursés sur ton ${paymentLabel(booking.paymentMethod)}${booking.paymentMethod === 'bancontact' ? ' : le virement arrive sur ton compte en 2 à 5 jours, sans forcément porter la mention « remboursement »' : ' : comptes quelques jours selon ta banque'}.`
    : 'Rien n’avait été débité.';
  return {
    to: user.email,
    subject: `Réservation annulée : ${venue.name}, ${day.toLowerCase()} à ${time}`,
    text: `Ta réservation chez ${venue.name} (${day} à ${time}, ${booking.people} pers., code ${booking.code}) est annulée.\n${refund}\n\nD'autres créneaux creux t'attendent : ${app()}`,
    html: layout(
      'Réservation annulée',
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Ta réservation chez <b>${h(venue.name)}</b>, ${h(day.toLowerCase())} à ${time} (${booking.people} pers.), est annulée.</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.5">${refund}</p>
<a href="${app()}" style="display:block;background:#3A28D4;color:#fff;text-decoration:none;text-align:center;font-weight:700;border-radius:12px;padding:14px">Voir d’autres créneaux</a>`,
    ),
    attachments: [{ filename: `aubaine-${booking.code}.ics`, content: Buffer.from(bookingIcs(row, true)).toString('base64'), contentType: 'text/calendar; charset=utf-8; method=CANCEL' }],
  };
}
