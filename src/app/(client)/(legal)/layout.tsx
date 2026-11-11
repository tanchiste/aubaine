import { LegalNav } from './LegalNav';

/** Pages d'information : aide, conditions, confidentialité, cookies, mentions légales */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="section legal-wrap">
      <LegalNav />
      <article className="legal">{children}</article>
    </div>
  );
}
