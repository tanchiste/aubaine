import { getBooking } from '@/lib/bookings';
import { bookingIcs } from '@/lib/ics';

/** Fichier calendrier (.ics) pour ajouter la séance à son agenda */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const row = await getBooking((await ctx.params).id);
  if (!row || row.booking.status === 'pending') return new Response('Introuvable', { status: 404 });
  return new Response(bookingIcs(row, row.booking.status === 'cancelled'), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="aubaine-${row.booking.code}.ics"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
