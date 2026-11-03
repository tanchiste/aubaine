import Link from 'next/link';
import type { Metadata } from 'next';
import { IconTicket } from '@/components/icons';

export const metadata: Metadata = { title: 'Billets' };

export default function TicketsPage() {
  return (
    <div className="section" style={{ paddingTop: 28 }}>
      <h1 className="display" style={{ fontSize: 24 }}>Tes billets</h1>
      <div className="empty card">
        <IconTicket size={32} />
        <b>Aucun billet pour l’instant</b>
        <p className="small">Tes réservations apparaîtront ici, avec le code à montrer à l’accueil.</p>
        <Link className="btn btn-primary btn-sm" href="/">Trouver un créneau</Link>
      </div>
    </div>
  );
}
