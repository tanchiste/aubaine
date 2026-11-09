'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Signale qu'une navigation commence (menus et calendriers qui naviguent par code) */
export const startNavigation = () => window.dispatchEvent(new Event('aub:nav'));

/**
 * Fine barre en haut de l'écran dès qu'on touche un lien : la réponse est immédiate,
 * même quand la page suivante met un moment à arriver sur un réseau mobile.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'on' | 'done'>('idle');
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La nouvelle adresse est affichée : la barre se termine.
  useEffect(() => {
    setState((s) => (s === 'on' ? 'done' : s));
    const t = setTimeout(() => setState((s) => (s === 'done' ? 'idle' : s)), 400);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      setState('on');
      if (safety.current) clearTimeout(safety.current);
      safety.current = setTimeout(() => setState('idle'), 12000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || a.target || a.hasAttribute('download') || a.getAttribute('aria-disabled') === 'true') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('aub:nav', start);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('aub:nav', start);
      if (safety.current) clearTimeout(safety.current);
    };
  }, []);

  return <div className={`nav-progress${state === 'idle' ? '' : ` ${state}`}`} aria-hidden="true" />;
}
