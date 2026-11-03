import type { Metadata, Viewport } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Aubaine · Les loisirs à prix creux', template: '%s · Aubaine' },
  description: 'Karting, escape game, laser game, VR, bien-être : réserve les heures creuses des loisirs du Hainaut, jusqu’à −50 %.',
  applicationName: 'Aubaine',
};

export const viewport: Viewport = { themeColor: '#F1F0F6', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
