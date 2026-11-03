'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconCamera, IconTrash } from '@/components/icons';
import { deletePhotoAction, makeCoverAction, uploadPhotoAction } from '../actions';

type Photo = { id: string };

/** Réduit la photo dans le navigateur (1600 px max, WebP) avant l'envoi : rapide même en 4G */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob('image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  if (!blob) throw new Error('Photo illisible.');
  return { blob, width, height };
}

export function PhotoManager({ venueId, photos, locked }: { venueId: string; photos: Photo[]; locked: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 8);
    for (let i = 0; i < list.length; i++) {
      setBusy(`Envoi ${i + 1} / ${list.length}…`);
      try {
        const { blob, width, height } = await shrink(list[i]);
        const fd = new FormData();
        fd.set('venueId', venueId);
        fd.set('file', new File([blob], `photo.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type }));
        fd.set('width', String(width));
        fd.set('height', String(height));
        const r = await uploadPhotoAction(fd);
        if (r.error) {
          setError(r.error);
          break;
        }
      } catch {
        setError('Cette photo n’a pas pu être lue. Essaie en JPEG ou PNG.');
        break;
      }
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    startTransition(() => router.refresh());
  }

  return (
    <section className="card stack" aria-labelledby="f-photos">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="f-photos" style={{ fontSize: 15, fontWeight: 800 }}>Photos</h2>
        <span className="small muted">{photos.length} / 8 · 3 minimum</span>
      </div>
      <p className="small muted">Des photos lumineuses de l’activité en action. La première sert de couverture.</p>
      <div className="photos">
        {photos.map((p, i) => (
          <div key={p.id} className="photo">
            <img src={`/api/photos/${p.id}`} alt={`Photo ${i + 1}`} />
            {!locked && (
              <form action={deletePhotoAction}>
                <input type="hidden" name="photoId" value={p.id} />
                <button aria-label={`Supprimer la photo ${i + 1}`}><IconTrash size={16} /></button>
              </form>
            )}
            {i === 0 ? (
              <span className="first pill pill-primary">Couverture</span>
            ) : (
              !locked && (
                <form action={makeCoverAction} className="first">
                  <input type="hidden" name="photoId" value={p.id} />
                  <button className="pill pill-muted" style={{ position: 'static', width: 'auto', height: 'auto', border: 0, cursor: 'pointer' }}>Mettre en couverture</button>
                </form>
              )
            )}
          </div>
        ))}
        {!locked && photos.length < 8 && (
          <label className="photo-add">
            <IconCamera size={24} />
            {busy ?? 'Ajouter'}
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={!!busy} onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
