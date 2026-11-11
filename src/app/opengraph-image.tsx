import { ImageResponse } from 'next/og';

export const alt = 'Aubaine : les loisirs du Hainaut aux heures creuses, jusqu’à −50 %';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Image d'aperçu quand on partage Aubaine (WhatsApp, Messenger, réseaux sociaux) */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#17142E', color: '#fff', padding: '72px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <svg width="76" height="76" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="#fff" stroke="#6C5CFF" strokeWidth="3" />
            <path d="M12 12V3a9 9 0 0 1 9 9z" fill="#CF3520" />
            <circle cx="12" cy="12" r="1.8" fill="#17142E" />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>aubaine</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>Les loisirs du Hainaut aux heures creuses</span>
          <span style={{ fontSize: 34, color: '#C9C5E6' }}>Karting, escape game, bowling, bien-être… jusqu’à −50 %</span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {['−40 %', '−35 %', '−50 %'].map((d) => (
            <span key={d} style={{ background: '#FFB21A', color: '#17142E', fontSize: 30, fontWeight: 800, padding: '10px 22px', borderRadius: 999 }}>
              {d}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
