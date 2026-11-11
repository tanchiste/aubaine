import { TERMS_VERSION } from '@/lib/legal';

const versionFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Valeur de la société, ou un repère bien visible tant qu'elle n'est pas renseignée */
export function Fill({ v, fallback }: { v: string; fallback?: string }) {
  if (v.trim()) return <>{v}</>;
  if (fallback) return <>{fallback}</>;
  return <mark className="todo">à compléter</mark>;
}

/** En-tête commun : titre, date de la version, et résumé en clair */
export function DocHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="legal-head">
      <h1 className="display">{title}</h1>
      <p className="small muted">Version du {versionFmt.format(new Date(TERMS_VERSION + 'T12:00:00Z'))}</p>
      {children && <div className="legal-summary">{children}</div>}
    </header>
  );
}
