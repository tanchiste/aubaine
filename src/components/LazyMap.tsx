'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { VenueMap as VenueMapType } from './VenueMap';

// Leaflet (script et feuille de style) ne se charge que pour afficher une carte, jamais pour la liste.
const VenueMap = dynamic(() => import('./VenueMap').then((m) => m.VenueMap), { ssr: false, loading: () => null });

type Props = ComponentProps<typeof VenueMapType>;

/**
 * Carte chargée à la demande : un fond de la même taille tient la place (pas de saut de mise en page),
 * et la carte arrive quand elle approche de l'écran.
 */
export function LazyMap(props: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={slot} className="map-slot">
      <div className={`venue-map${props.className ? ` ${props.className}` : ''}`} aria-hidden="true" />
      {near && <VenueMap {...props} />}
    </div>
  );
}

export type { MapPin } from './VenueMap';
