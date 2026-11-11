import 'server-only';
import nodemailer from 'nodemailer';
import type { Booking, Offer, Slot, Venue } from '@/db/schema';
import { CANCEL_HOURS } from './bookings-rules';
import { isAdminEmail } from './env';
import { companyLine } from './legal';
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
    await nodemailer
      .createTransport(smtp)
      .sendMail({
      from: sender(),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType })),
      })
      .catch((e: { code?: string; responseCode?: number; response?: string }) => {
        // Dans les logs Vercel : la cause (identifiants refusés, serveur injoignable…), jamais le mot de passe
        console.error('[email] échec SMTP', e.code, e.responseCode, String(e.response ?? '').slice(0, 160));
        throw new Error("L'email n'a pas pu être envoyé.");
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

const METHOD_LABEL: Record<string, string> = {
  bancontact: 'Bancontact',
  card: 'carte bancaire',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  link: 'Link',
  simulé: 'paiement simulé (phase de test)',
};
export const paymentLabel = (m: string | null) => (m ? (METHOD_LABEL[m] ?? m) : 'paiement en ligne');

/** Pied de page des emails aux clients */
const CLIENT_FOOTER = 'Tu reçois cet email parce que tu as réservé sur Aubaine.';
/** Pied de page des emails aux exploitants, avec le moyen de les couper */
const venueFooter = (venue: Venue) => `Tu reçois cet email parce que tu fais partie de l’équipe de ${h(venue.name)} sur Aubaine. Le gérant peut couper ces emails dans <a href="${app()}/pro/equipe" style="color:#6B6882">Équipe</a>.`;

/** Qui fournit la prestation (obligation d'information des places de marché) */
export const providerOf = (v: Pick<Venue, 'name' | 'legalName' | 'companyNumber'>) =>
  `${v.legalName ?? v.name}${v.companyNumber ? `, n° d’entreprise ${v.companyNumber}` : ''}`;

/** Mise en page commune : sobre, lisible sans images, aux couleurs d'Aubaine */
function layout(title: string, body: string, footer = CLIENT_FOOTER): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F2F1F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#17142E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F1F6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 14px;font-size:20px;font-weight:800;letter-spacing:-0.5px"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:3px solid #3A28D4;vertical-align:-2px;margin-right:6px"></span>aubaine</td></tr>
<tr><td style="background:#fff;border-radius:18px;padding:24px 22px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${title}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 6px;font-size:12px;color:#6B6882;line-height:1.5">Aubaine, les loisirs du Hainaut aux heures creuses. ${footer}<br>${h(companyLine())} · <a href="${app()}/conditions" style="color:#6B6882">Conditions</a> · <a href="${app()}/confidentialite" style="color:#6B6882">Confidentialité</a></td></tr>
</table></td></tr></table></body></html>`;
}

function detailsRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px">${rows
    .map(([k, v]) => `<tr><td style="padding:7px 0;color:#6B6882;border-bottom:1px solid #EEEDF3">${k}</td><td align="right" style="padding:7px 0;font-weight:700;border-bottom:1px solid #EEEDF3">${v}</td></tr>`)
    .join('')}</table>`;
}

/** Informations du contrat, sur support durable : prestataire, intermédiaire, prix, rétractation */
const LEGAL_TEXT = (venue: Venue) =>
  `Activité fournie par ${providerOf(venue)}. Réservation et paiement pris par Aubaine (${companyLine()}) au nom de l’exploitant. Prix TVA comprise. Activité de loisirs à date fixe : pas de délai de rétractation de 14 jours (art. VI.53, 12° CDE), annulation gratuite jusqu’à ${CANCEL_HOURS} h avant.`;

/** Phrase de remboursement, selon le moyen de paiement */
function refundText(booking: Booking, refunded: boolean): string {
  if (!refunded) return 'Rien n’avait été débité.';
  return `${euros(booking.totalCents)} te sont remboursés par ${paymentLabel(booking.paymentMethod)}${booking.paymentMethod === 'bancontact' ? ' : le virement arrive sur ton compte en 2 à 5 jours, sans forcément porter la mention « remboursement »' : ' : comptes quelques jours selon ta banque'}.`;
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
    `Annulation gratuite jusqu'à ${CANCEL_HOURS} h avant, depuis ton billet${booking.paymentMethod && booking.paymentMethod !== 'simulé' ? ' : tu es remboursé sur ton moyen de paiement' : ''}.`,
    '',
    LEGAL_TEXT(venue),
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
<p style="margin:8px 0 0;font-size:13px;color:#6B6882;line-height:1.5">Annulation gratuite jusqu’à ${CANCEL_HOURS} h avant, depuis ton billet. Le fichier joint ajoute la séance à ton agenda.</p>
<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #EEEDF3;font-size:12px;color:#6B6882;line-height:1.5">${h(LEGAL_TEXT(venue))} <a href="${app()}/conditions" style="color:#6B6882">Conditions de réservation</a></p>`,
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
  const refund = refundText(booking, refunded);
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

/* ---------- Notifications ---------- */

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:block;background:#3A28D4;color:#fff;text-decoration:none;text-align:center;font-weight:700;border-radius:12px;padding:14px">${label}</a>`;
const link = (href: string, label: string) => `<a href="${href}" style="display:block;color:#3A28D4;text-decoration:none;text-align:center;font-weight:700;padding:12px">${label}</a>`;
const para = (html: string, extra = '') => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5${extra}">${html}</p>`;
const when = (slot: Slot) => ({ day: capitalize(longDate(brusselsDate(slot.startsAt))), time: timeLabel(slot.startsAt) });
const mapsUrl = (venue: Venue) => {
  const where = venue.address ?? venue.city;
  return venue.lat !== null && venue.lng !== null
    ? `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`;
};
/** Lien vers le créneau dans le planning de l'exploitant */
const planningUrl = (slot: Slot) => `${app()}/pro/creneaux?semaine=${brusselsDate(slot.startsAt)}&creneau=${slot.id}`;

/** Rappel envoyé la veille au client */
export function bookingReminderMail(row: BookingRow): Mail {
  const { booking, slot, venue, offer, user } = row;
  const { time } = when(slot);
  const deadline = new Date(slot.startsAt.getTime() - CANCEL_HOURS * 3_600_000);
  const deadlineLabel = `${brusselsDate(deadline) === brusselsDate(slot.startsAt) ? 'demain' : 'ce soir'} à ${timeLabel(deadline)}`;
  const where = venue.address ?? venue.city;
  const ticket = `${app()}/billets/${booking.id}`;
  const hello = user.firstName ? `${user.firstName}, ` : '';
  return {
    to: user.email,
    subject: `Demain à ${time} : ${venue.name}`,
    text: `${hello}c'est demain !\n\n${venue.name} · ${offer.name}\nDemain à ${time}, ${booking.people} pers.\nAdresse : ${where}\nCode à l'accueil : ${booking.code}\n\nTon billet : ${ticket}\nItinéraire : ${mapsUrl(venue)}\n\nUn empêchement ? Tu peux encore annuler gratuitement jusqu'à ${deadlineLabel}, depuis ton billet.`,
    html: layout(
      `${h(hello)}c’est demain !`,
      `${para(`<b>${h(venue.name)}</b> t’attend <b>demain à ${time}</b> pour ${h(offer.name)} (${booking.people} pers.).`)}
<div style="background:#17142E;color:#fff;border-radius:14px;padding:16px;text-align:center;margin:0 0 16px">
<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;opacity:.75">CODE À L’ACCUEIL</div>
<div style="font-size:30px;font-weight:800;letter-spacing:6px;margin-top:4px">${booking.code}</div></div>
${para(h(where), ';font-size:14px')}
${btn(mapsUrl(venue), 'Itinéraire')}
${link(ticket, 'Voir mon billet')}
<p style="margin:8px 0 0;font-size:13px;color:#6B6882;line-height:1.5">Un empêchement ? Tu peux encore annuler gratuitement jusqu’à ${deadlineLabel}, depuis ton billet.</p>`,
    ),
  };
}

/** Annulation décidée par l'établissement : le client est remboursé en entier */
export function bookingCancelledByVenueMail(row: BookingRow, reason: string, refunded: boolean): Mail {
  const { booking, slot, venue, user } = row;
  const { day, time } = when(slot);
  const refund = refundText(booking, refunded);
  return {
    to: user.email,
    subject: `${venue.name} a annulé ta réservation du ${day.toLowerCase()}`,
    text: `${venue.name} a dû annuler ta réservation (${day} à ${time}, ${booking.people} pers., code ${booking.code}).\nMotif : ${reason}\n\n${refund}\n\nD'autres créneaux t'attendent : ${app()}/lieu/${venue.slug}`,
    html: layout(
      'Réservation annulée par le lieu',
      `${para(`<b>${h(venue.name)}</b> a dû annuler ta réservation du ${h(day.toLowerCase())} à ${time} (${booking.people} pers.). Désolé pour le contretemps.`)}
<div style="background:#F6F5FA;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:14px;line-height:1.5"><b>Motif :</b> ${h(reason)}</div>
${para(refund, ';font-size:14px')}
${btn(`${app()}/lieu/${venue.slug}`, 'Choisir un autre créneau')}`,
    ),
  };
}

/** Nouvelle réservation ou annulation d'un client : prévient l'équipe de l'établissement */
export function venueBookingMail(row: BookingRow, kind: 'new' | 'cancelled', to: string): Mail {
  const { booking, slot, venue, offer, user } = row;
  const { day, time } = when(slot);
  const who = user.firstName ?? 'Un client';
  const isNew = kind === 'new';
  const subject = isNew ? `Nouvelle réservation : ${who}, ${day.toLowerCase()} à ${time}` : `Annulation : ${who}, ${day.toLowerCase()} à ${time}`;
  const rows: [string, string][] = [
    ['Client', h(who)],
    ['Prestation', h(offer.name)],
    ['Quand', `${h(day)}, ${time}`],
    ['Groupe', `${booking.people} pers.`],
    ...(isNew ? ([['Payé', `${euros(booking.totalCents)} (−${booking.discountPct} %)`], ['Code', booking.code]] as [string, string][]) : []),
  ];
  const lead = isNew
    ? `${h(who)} a réservé chez <b>${h(venue.name)}</b>. Le client donnera son code à l’accueil.`
    : `${h(who)} a annulé sa réservation chez <b>${h(venue.name)}</b> (plus de ${CANCEL_HOURS} h avant). Il est remboursé et la place est de nouveau proposée sur Aubaine.`;
  return {
    to,
    subject,
    text: `${subject}\n\n${rows.map(([k, v]) => `${k} : ${v.replace(/<[^>]+>/g, '')}`).join('\n')}\n\nPlanning : ${planningUrl(slot)}`,
    html: layout(isNew ? 'Nouvelle réservation' : 'Réservation annulée', `${para(lead)}${detailsRows(rows)}${btn(planningUrl(slot), 'Voir dans le planning')}`, venueFooter(venue)),
  };
}

export type DigestLine = { time: string; firstName: string | null; people: number; offer: string; code: string };

/** Récap envoyé la veille à l'équipe : qui arrive demain, à quelle heure */
export function venueDigestMail(venue: Venue, day: string, lines: DigestLine[], to: string): Mail {
  const n = lines.length;
  const people = lines.reduce((s, l) => s + l.people, 0);
  const label = capitalize(longDate(day));
  const subject = `Demain chez ${venue.name} : ${n} réservation${n > 1 ? 's' : ''}, ${people} pers.`;
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px">${lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EEEDF3;font-weight:800;width:56px">${l.time}</td><td style="padding:8px 0;border-bottom:1px solid #EEEDF3">${h(l.firstName ?? 'Client')} · ${l.people} pers.<br><span style="color:#6B6882;font-size:12px">${h(l.offer)}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #EEEDF3;font-family:monospace;font-weight:700;letter-spacing:1px">${l.code}</td></tr>`,
    )
    .join('')}</table>`;
  return {
    to,
    subject,
    text: `${label} chez ${venue.name} :\n\n${lines.map((l) => `${l.time}  ${l.firstName ?? 'Client'}, ${l.people} pers., ${l.offer} (code ${l.code})`).join('\n')}\n\nEspace exploitant : ${app()}/pro`,
    html: layout(`${h(label)} : ${n} réservation${n > 1 ? 's' : ''}`, `${para(`Voici qui vient chez <b>${h(venue.name)}</b> demain (${people} pers. au total).`)}${table}${btn(`${app()}/pro`, 'Ouvrir l’espace exploitant')}`, venueFooter(venue)),
  };
}

/** Signalement reçu : prévient l'équipe Aubaine */
export function reportAdminMail(to: string, r: { id: string; reason: string; details: string; venueName: string | null; email: string | null }): Mail {
  return {
    to,
    subject: `Signalement : ${r.reason}${r.venueName ? `, ${r.venueName}` : ''}`,
    text: `${r.venueName ? `Fiche : ${r.venueName}\n` : ''}Motif : ${r.reason}\nDe : ${r.email ?? 'anonyme'}\n\n${r.details}\n\nTraiter : ${app()}/admin/signalements`,
  };
}

/** Décision motivée envoyée à la personne qui a signalé */
export function reportDecisionMail(to: string, decision: string, venueName: string | null): Mail {
  return {
    to,
    subject: 'Ton signalement sur Aubaine a été traité',
    text: `Merci pour ton signalement${venueName ? ` concernant ${venueName}` : ''}.\n\nNotre décision : ${decision}\n\nTu peux répondre à cet email si tu n'es pas d'accord.`,
    html: layout(
      'Ton signalement a été traité',
      `${para(`Merci pour ton signalement${venueName ? ` concernant <b>${h(venueName)}</b>` : ''}.`)}<div style="background:#F6F5FA;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:14px;line-height:1.5"><b>Notre décision :</b> ${h(decision)}</div>${para('Tu peux répondre à cet email si tu n’es pas d’accord.', ';font-size:13px;color:#6B6882')}`,
      'Tu reçois cet email parce que tu as fait un signalement sur Aubaine.',
    ),
  };
}

/* ---------- Contrôle de la configuration ---------- */

let lastCheck: { at: number; result: { ok: boolean; detail: string } } | null = null;

/**
 * Vérifie que le serveur SMTP accepte la connexion (sans envoyer d'email).
 * Limité à un essai toutes les 5 minutes pour ne pas solliciter Gmail à chaque visite.
 */
export async function checkSmtp(): Promise<{ ok: boolean; detail: string }> {
  const smtp = process.env.SMTP_URL;
  if (!smtp) return { ok: false, detail: 'SMTP_URL absent' };
  if (lastCheck && Date.now() - lastCheck.at < 5 * 60_000) return lastCheck.result;
  const result = await diagnoseSmtp(smtp.trim());
  lastCheck = { at: Date.now(), result };
  return result;
}

/** Repère les erreurs de saisie courantes avant même d'appeler le serveur, puis teste la connexion */
async function diagnoseSmtp(smtp: string): Promise<{ ok: boolean; detail: string }> {
  if (/^["']|["']$/.test(smtp)) return { ok: false, detail: 'SMTP_URL contient des guillemets : enlève-les' };
  if (/\s/.test(smtp)) return { ok: false, detail: 'SMTP_URL contient des espaces : le mot de passe d’application s’écrit sans espaces' };
  let url: URL;
  try {
    url = new URL(smtp);
  } catch {
    return { ok: false, detail: 'SMTP_URL mal formée : modèle smtps://adresse%40gmail.com:motdepasse@smtp.gmail.com:465' };
  }
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  if (url.protocol !== 'smtps:' && url.protocol !== 'smtp:') return { ok: false, detail: 'SMTP_URL doit commencer par smtps://' };
  if (!user.includes('@')) return { ok: false, detail: 'adresse email introuvable dans SMTP_URL : le @ de l’adresse s’écrit %40' };
  if (!pass) return { ok: false, detail: 'mot de passe absent dans SMTP_URL (après les deux-points qui suivent l’adresse)' };
  if (url.hostname === 'smtp.gmail.com' && pass.length !== 16)
    return { ok: false, detail: `le mot de passe fait ${pass.length} caractères : un mot de passe d’application Google en fait 16 (pas ton mot de passe Gmail habituel)` };
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 9000));
    await Promise.race([nodemailer.createTransport(smtp).verify(), timeout]);
    return { ok: true, detail: `connexion acceptée pour ${user}` };
  } catch (e) {
    const { code, responseCode, response } = e as { code?: string; responseCode?: number; response?: string };
    const server = String(response ?? '').replace(/\s+/g, ' ').slice(0, 140);
    if (code === 'EAUTH')
      return {
        ok: false,
        detail: `Gmail refuse la connexion de ${user} (${responseCode ?? '?'}) : vérifie la validation en deux étapes et le mot de passe d’application, et regarde si une alerte de sécurité est arrivée dans la boîte Gmail. Réponse : ${server}`,
      };
    if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(code ?? '')) return { ok: false, detail: `serveur ${url.hostname}:${url.port || '465'} injoignable (${code})` };
    return { ok: false, detail: `erreur inattendue${code ? ` (${code})` : ''}${server ? ` : ${server}` : ''}` };
  }
}
