import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, strokeWidth = 1.8, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const IconPin = (p: P) => (<svg {...base(p)}><path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>);
export const IconChevronDown = (p: P) => (<svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>);
export const IconChevronRight = (p: P) => (<svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>);
export const IconBack = (p: P) => (<svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>);
export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>);
export const IconCompass = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>);
export const IconTicket = (p: P) => (<svg {...base(p)}><path d="M3.5 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="2 2" /></svg>);
export const IconUser = (p: P) => (<svg {...base(p)}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.9-4 3.8-6 7.5-6s6.6 2 7.5 6" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: P) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconClock = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconUsers = (p: P) => (<svg {...base(p)}><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.7-3.3 3-5 6-5s5.3 1.7 6 5" /><circle cx="17" cy="9.5" r="2.5" /><path d="M16.5 14.6c2.3.2 3.9 1.8 4.5 4.4" /></svg>);
export const IconCheck = (p: P) => (<svg {...base({ strokeWidth: 2.4, ...p })}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconX = (p: P) => (<svg {...base({ strokeWidth: 2.2, ...p })}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconBolt = (p: P) => (<svg {...base({ strokeWidth: 2, ...p })}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg>);
export const IconGrid = (p: P) => (<svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /></svg>);
export const IconBank = (p: P) => (<svg {...base(p)}><path d="M3.5 9.5L12 4l8.5 5.5z" /><path d="M5.5 10v7.5M9.8 10v7.5M14.2 10v7.5M18.5 10v7.5M3.5 20h17" /></svg>);
export const IconHome = (p: P) => (<svg {...base(p)}><path d="M4 10.5L12 4l8 6.5V20H4z" /><path d="M9.5 20v-5.5h5V20" /></svg>);
export const IconCamera = (p: P) => (<svg {...base(p)}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const IconTrash = (p: P) => (<svg {...base(p)}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>);
export const IconLogout = (p: P) => (<svg {...base(p)}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" /></svg>);
export const IconShield = (p: P) => (<svg {...base(p)}><path d="M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5z" /></svg>);
export const IconStore = (p: P) => (<svg {...base(p)}><path d="M4 9.5L5.5 4h13L20 9.5M4 9.5h16M4 9.5c0 1.7 1.3 3 3 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.3 3s2.3-1.3 2.3-3c0 1.7 1 3 2.7 3s3-1.3 3-3M5.5 12.5V20h13v-7.5" /></svg>);
export const IconImage = (p: P) => (<svg {...base(p)}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8.5 8" /></svg>);
export const IconSwap = (p: P) => (<svg {...base({ strokeWidth: 2, ...p })}><path d="M8 9l4-4 4 4M8 15l4 4 4-4" /></svg>);
export const IconEye = (p: P) => (<svg {...base(p)}><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>);

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#3A28D4" strokeWidth="3" />
      <path d="M12 12V3a9 9 0 0 1 9 9z" fill="#CF3520" />
      <circle cx="12" cy="12" r="1.8" fill="#17142E" />
    </svg>
  );
}

export function LogoMarkLight({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#A99DFF" strokeWidth="3" />
      <path d="M12 12V3a9 9 0 0 1 9 9z" fill="#FF6A4D" />
      <circle cx="12" cy="12" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}
