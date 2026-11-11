import { requireAdmin } from '@/lib/auth';
import { dueForMonth, formatIban, isMonth, monthOf, payoutReference, shiftMonth } from '@/lib/payouts';

/** Liste des virements du mois, à ouvrir dans un tableur ou à recopier dans l'appli bancaire (séparateur « ; ») */
export async function GET(req: Request) {
  await requireAdmin();
  const q = new URL(req.url).searchParams.get('mois') ?? undefined;
  const month = isMonth(q) ? q : shiftMonth(monthOf(), -1);
  const rows = await dueForMonth(month);
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const lines = [
    ['Bénéficiaire', 'IBAN', 'Montant (EUR)', 'Communication', 'Établissement', 'Nom légal', 'N° d’entreprise', 'Réservations', 'Encaissé', 'Commission', 'Statut'],
    ...rows.map((r) => [
      r.payout?.holder ?? r.holder ?? '',
      formatIban(r.payout?.iban ?? r.iban ?? ''),
      money(r.amountCents),
      r.payout?.reference ?? payoutReference(month, r.name),
      r.name,
      r.legalName ?? '',
      r.companyNumber ?? '',
      r.count,
      money(r.totalCents),
      money(r.feeCents),
      r.payout ? `viré le ${r.payout.paidAt.toISOString().slice(0, 10)}` : r.iban ? 'à virer' : 'IBAN manquant',
    ]),
  ];
  // BOM : Excel lit correctement les accents
  const body = '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n') + '\r\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="aubaine-virements-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
