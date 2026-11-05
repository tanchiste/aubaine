'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Map as LMap } from 'leaflet';
import { distanceKm } from '@/lib/geo';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  /** meilleure remise affichée sur l'épingle */
  pct: number;
  /** ligne d'infos sous le nom (« dès 13,20 € · 4,2 km ») */
  line: string;
  href: string;
};
type Pos = { lat: number; lng: number };

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Contenu de bulle construit en DOM (les noms viennent des exploitants : jamais en HTML brut) */
function popupNode(p: MapPin, go: (href: string) => void) {
  const box = document.createElement('div');
  box.className = 'map-pop';
  const b = document.createElement('b');
  b.textContent = p.name;
  const line = document.createElement('span');
  line.textContent = p.line;
  const a = document.createElement('a');
  a.href = p.href;
  a.textContent = 'Voir les créneaux';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    go(p.href);
  });
  box.append(b, line, a);
  return box;
}

/** Carte des lieux : une épingle par lieu avec sa meilleure remise, et ta position si tu l'as partagée */
export function VenueMap({ pins, me, single = false, className }: { pins: MapPin[]; me?: Pos | null; single?: boolean; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const key = JSON.stringify([pins.map((p) => [p.id, p.pct, p.line]), me]);

  useEffect(() => {
    let map: LMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: !single, scrollWheelZoom: false, attributionControl: true, dragging: !single || !L.Browser.mobile });
      L.tileLayer(TILES, { maxZoom: 18, attribution: ATTRIBUTION, className: 'map-tiles' }).addTo(map);
      map.attributionControl.setPrefix(false);

      const points: [number, number][] = [];
      // Avec ta position, on cadre sur ce qui est proche (20 km) pour que les épingles ne se chevauchent pas.
      const closeBy = me ? pins.filter((p) => distanceKm(me, p) <= 20) : pins;
      const framed = new Set((closeBy.length >= 2 ? closeBy : pins).map((p) => p.id));
      for (const p of pins) {
        const icon = L.divIcon({ className: 'map-pin', html: `<span>−${Math.round(p.pct)} %</span>`, iconSize: [64, 32], iconAnchor: [32, 32] });
        const m = L.marker([p.lat, p.lng], { icon, title: p.name, riseOnHover: true }).addTo(map);
        if (!single) m.bindPopup(popupNode(p, (href) => router.push(href)), { closeButton: false, offset: [0, -28] });
        if (framed.has(p.id)) points.push([p.lat, p.lng]);
      }
      if (me) {
        L.circleMarker([me.lat, me.lng], { radius: 8, weight: 3, color: '#fff', fillColor: '#3A28D4', fillOpacity: 1 }).addTo(map).bindTooltip('Toi', { direction: 'top' });
        points.push([me.lat, me.lng]);
      }
      if (points.length === 0) map.setView([50.45, 3.95], 10);
      else if (points.length === 1) map.setView(points[0], 14);
      else map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, single]);

  return <div ref={el} className={`venue-map${className ? ` ${className}` : ''}`} role="region" aria-label="Carte des activités" />;
}
