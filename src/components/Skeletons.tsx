/**
 * Squelettes affichés instantanément pendant qu'une page arrive du serveur.
 * Ils reprennent la forme de la page attendue pour que rien ne saute à l'arrivée du contenu.
 */
const S = ({ w, h, r, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) => (
  <span className="sk" style={{ width: w ?? '100%', height: h ?? 14, borderRadius: r, ...style }} />
);

export function FicheSkeleton() {
  return (
    <article className="fiche" aria-busy="true" aria-label="Chargement de la fiche">
      <div className="fiche-main">
        <div className="hero">
          <S h={undefined} r={0} style={{ height: '100%' }} />
        </div>
        <div className="section" style={{ paddingTop: 16 }}>
          <S w={90} h={22} r={11} />
          <S w="70%" h={30} r={8} />
          <div className="row" style={{ ['--gap' as string]: '8px' }}>
            <S w={80} h={30} r={15} />
            <S w={90} h={30} r={15} />
            <S w={110} h={30} r={15} />
          </div>
          <S h={14} />
          <S w="85%" h={14} />
        </div>
      </div>
      <aside className="fiche-side">
        <section className="section">
          <S w={160} h={22} r={8} />
          <div className="row" style={{ ['--gap' as string]: '6px' }}>
            {Array.from({ length: 7 }, (_, i) => (
              <S key={i} w={48} h={72} r={14} />
            ))}
          </div>
          <div className="slots">
            {Array.from({ length: 6 }, (_, i) => (
              <S key={i} h={98} r={14} />
            ))}
          </div>
        </section>
      </aside>
    </article>
  );
}

export function ListSkeleton({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="section" style={{ paddingTop: 22 }} aria-busy="true" aria-label={label}>
      <S w="55%" h={28} r={8} />
      <S w="35%" h={14} />
      {Array.from({ length: 3 }, (_, i) => (
        <S key={i} h={96} r={18} />
      ))}
    </div>
  );
}

export function ProSkeleton() {
  return (
    <div className="stack" style={{ ['--gap' as string]: '16px' }} aria-busy="true" aria-label="Chargement">
      <S w={220} h={28} r={8} />
      <div className="row" style={{ ['--gap' as string]: '12px' }}>
        <S h={88} r={18} />
        <S h={88} r={18} />
        <S h={88} r={18} />
      </div>
      <S h={260} r={18} />
    </div>
  );
}
