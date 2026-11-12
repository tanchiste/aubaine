'use client';
import { useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Bas de liste : quand il approche de l'écran, la page se recharge avec un jour de plus (paramètre « plus »),
 * sans remonter en haut. Le chargement automatique ne démarre qu'une fois que la personne a fait défiler
 * la page : sans ça, une liste courte se rechargerait toute seule à l'ouverture et pourrait annuler
 * le clic sur une fiche. Le bouton reste là pour charger à la main.
 */
export function LoadMore({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const [pending, start] = useTransition();
  const armed = useRef(false);
  // Dernier clic sur un lien de la page : un chargement automatique juste après annulerait cette navigation
  const lastClick = useRef(0);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a, button');
      if (a && !a.closest('.load-more')) lastClick.current = Date.now();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    let io: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      const wait = 2000 - (Date.now() - lastClick.current);
      if (wait > 0) {
        timer = setTimeout(load, wait);
        return;
      }
      if (window.location.pathname === '/') start(() => router.replace(href, { scroll: false }));
    };
    const watch = () => {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io?.disconnect();
          load();
        },
        { rootMargin: '0px 0px 700px 0px' },
      );
      io.observe(el);
    };
    if (armed.current || window.scrollY > 0) {
      armed.current = true;
      watch();
      return () => {
        clearTimeout(timer);
        io?.disconnect();
      };
    }
    const onScroll = () => {
      armed.current = true;
      window.removeEventListener('scroll', onScroll);
      watch();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
      io?.disconnect();
    };
  }, [href, router]);

  return (
    <div className="load-more">
      <Link
        ref={ref}
        href={href}
        replace
        scroll={false}
        prefetch={false}
        className="btn"
        aria-busy={pending}
        onClick={(e) => {
          e.preventDefault();
          start(() => router.replace(href, { scroll: false }));
        }}
      >
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? 'Chargement…' : label}
      </Link>
    </div>
  );
}
