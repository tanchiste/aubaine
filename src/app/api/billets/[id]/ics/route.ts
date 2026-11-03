import { getBooking } from '@/lib/bookings';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

/** Fichier calendrier (.ics) pour ajouter la séance à son agenda */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const row = await getBooking((await ctx.params).id);
  if (!row) return new Response('Introuvable', { status: 404 });
  const { booking, slot, venue } = row;
  const end = new Date(slot.startsAt.getTime() + venue.durationMin * 60_000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aubaine//FR',
    'BEGIN:VEVENT',
    `UID:${booking.id}@aubaine`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(slot.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${venue.name} (${booking.people} pers.)`)}`,
    `LOCATION:${esc(venue.address ?? venue.city)}`,
    `DESCRIPTION:${esc(`Code à montrer à l'accueil : ${booking.code}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="aubaine-${booking.code}.ics"` },
  });
}
