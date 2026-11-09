'use client';

/** Dernier filet : remplace toute la page si la mise en page elle-même échoue (styles intégrés, sans dépendance) */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F1F0F6', color: '#17142E', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 16 }}>
        <title>Aubaine</title>
        <div style={{ maxWidth: 380, background: '#fff', borderRadius: 22, padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <b style={{ fontSize: 20 }}>aubaine</b>
          <h1 style={{ fontSize: 22, margin: 0 }}>Petit souci de notre côté</h1>
          <p style={{ margin: 0, color: '#6B6882', lineHeight: 1.5 }}>L’application n’a pas pu se charger. Réessaie dans un instant.</p>
          <button type="button" onClick={() => retry()} style={{ height: 48, border: 0, borderRadius: 14, background: '#3A28D4', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
