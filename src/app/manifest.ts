import type { MetadataRoute } from 'next';

/** Installation sur l'écran d'accueil du téléphone */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aubaine · Les loisirs à prix creux',
    short_name: 'Aubaine',
    description: 'Réserve les heures creuses des loisirs du Hainaut, jusqu’à −50 %.',
    lang: 'fr-BE',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F1F0F6',
    theme_color: '#F1F0F6',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
