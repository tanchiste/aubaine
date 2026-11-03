import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Checklist } from '@/components/Checklist';
import { StatusPill } from '@/components/ui';
import { IconEye } from '@/components/icons';
import { getProContext } from '@/lib/pro';
import { checklist, isReady, photoList } from '@/lib/venues';
import { PhotoManager } from './PhotoManager';
import { SubmitBox } from './SubmitBox';
import { VenueForm } from './VenueForm';

export const metadata = { title: 'Mon établissement' };

export default async function VenueSettingsPage({ searchParams }: { searchParams: Promise<{ nouveau?: string; envoye?: string }> }) {
  const { current } = await getProContext('/pro/etablissement');
  if (!current) redirect('/pro');
  const v = current.venue;
  const photos = await photoList(v.id);
  const items = checklist(v, photos.length);
  const locked = v.status === 'rejected';
  const canSubmit = v.status === 'draft' || v.status === 'changes_requested';
  const sp = await searchParams;
  const isNew = sp.nouveau === '1';

  return (
    <>
      <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Mon établissement</h1>
          <StatusPill status={v.status} />
        </div>
        <Link className="btn btn-sm" href={`/lieu/${v.slug}`}><IconEye size={16} /> Aperçu client</Link>
      </header>

      {isNew && <p className="notice notice-primary">Fiche créée ! Complète les infos ci-dessous, ajoute 3 photos, puis envoie-la en validation.</p>}
      {v.status === 'changes_requested' && v.reviewMessage && (
        <div className="notice notice-deal stack" style={{ ['--gap' as string]: '4px' }}>
          <b>Correction demandée</b>
          <span>{v.reviewMessage}</span>
        </div>
      )}
      {v.status === 'submitted' && (
        <p className="notice notice-amber">
          {sp.envoye === '1' ? 'Fiche envoyée ! On la vérifie et on te répond sous 24 h, par email.' : 'Fiche en validation.'} Tu peux encore la modifier pendant ce temps.
        </p>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <VenueForm
          locked={locked}
          v={{
            id: v.id, name: v.name, category: v.category, city: v.city, area: v.area, address: v.address, description: v.description,
            durationMin: v.durationMin, groupMin: v.groupMin, groupMax: v.groupMax, capacity: v.capacity, capacityUnit: v.capacityUnit,
            priceCents: v.priceCents, priceUnit: v.priceUnit, baseDiscountPct: v.baseDiscountPct, color: v.color,
          }}
        />
        <div className="stack" style={{ ['--gap' as string]: '14px' }}>
          <PhotoManager venueId={v.id} photos={photos} locked={locked} />
          {canSubmit && (
            <SubmitBox venueId={v.id} ready={isReady(items)}>
              <Checklist items={items} />
            </SubmitBox>
          )}
        </div>
      </div>
    </>
  );
}
