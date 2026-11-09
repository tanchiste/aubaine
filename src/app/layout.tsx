import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import { NavProgress } from '@/components/NavProgress';
import './globals.css';

export const dynamic = 'force-dynamic';

// Polices servies par l'app elle-même (préchargées, sans aller-retour vers Google Fonts)
const figtree = localFont({ src: '../fonts/figtree-latin-wght-normal.woff2', weight: '300 900', variable: '--font-figtree', display: 'swap' });
const unbounded = localFont({ src: '../fonts/unbounded-latin-wght-normal.woff2', weight: '200 900', variable: '--font-unbounded', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Aubaine · Les loisirs à prix creux', template: '%s · Aubaine' },
  description: 'Karting, escape game, laser game, VR, bien-être : réserve les heures creuses des loisirs du Hainaut, jusqu’à −50 %.',
  applicationName: 'Aubaine',
};

export const viewport: Viewport = { themeColor: '#F1F0F6', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${figtree.variable} ${unbounded.variable}`}>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
