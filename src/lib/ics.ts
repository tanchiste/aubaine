import type { Booking, Offer, Slot, Venue } from '@/db/schema';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

/** Fichier calendrier (.ics) d'une réservation : téléchargé depuis le billet et joint à l'email de confirmation */
export function bookingIcs({ booking, slot, venue, offer }: { booking: Booking; slot: Slot; venue: Venue; offer: Offer }, cancelled = false): string {
  const end = new Date(slot.startsAt.getTime() + offer.durationMin * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aubaine//FR',
    `METHOD:${cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${booking.id}@aubaine`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(slot.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${venue.name} (${booking.people} pers.)`)}`,
    `LOCATION:${esc(venue.address ?? venue.city)}`,
    `DESCRIPTION:${esc(`${offer.name}. Code à montrer à l'accueil : ${booking.code}`)}`,
    ...(cancelled ? ['STATUS:CANCELLED'] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
