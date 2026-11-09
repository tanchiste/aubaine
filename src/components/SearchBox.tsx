'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startNavigation } from './NavProgress';
import { IconSearch } from './icons';

type Suggestion = {
  categories: { key: string; label: string }[];
  venues: { slug: string; name: string; category: string; city: string; color: string; photoId: string | null; best: number | null; next: string | null }[];
};
type Item = { href: string; key: string };

/**
 * Recherche avec suggestions pendant la frappe.
 * `hrefFor` construit l'adresse d'une recherche complète ou d'un type d'activité en gardant les autres filtres.
 */
export function SearchBox({ defaultValue = '', searchHref, categoryHref, city }: { defaultValue?: string; searchHref: string; categoryHref: string; city?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [data, setData] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/recherche?q=${encodeURIComponent(term)}${city ? `&ville=${encodeURIComponent(city)}` : ''}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: Suggestion) => {
          setData(d);
          setActive(-1);
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, city]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items: Item[] = [
    ...(data?.categories ?? []).map((c) => ({ key: `c-${c.key}`, href: categoryHref.replace('__CAT__', c.key) })),
    ...(data?.venues ?? []).map((v) => ({ key: `v-${v.slug}`, href: `/lieu/${v.slug}` })),
  ];
  const go = (href: string) => {
    setOpen(false);
    startNavigation();
    router.push(href);
  };
  const submit = () => go(q.trim() ? searchHref.replace('__Q__', encodeURIComponent(q.trim())) : searchHref.replace(/[?&]q=__Q__/, ''));
  const showList = open && q.trim().length >= 2 && data !== null;

  return (
    <div className="search" ref={box} role="search">
      <IconSearch size={18} />
      <input
        className="input"
        type="search"
        value={q}
        placeholder="Karting, escape game, spa, Mons…"
        aria-label="Rechercher une activité"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active >= 0 && items[active]) go(items[active].href);
            else submit();
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {showList && (
        <div className="suggest" id={listId} role="listbox" aria-label="Suggestions">
          {items.length === 0 && <p className="suggest-empty">Aucun lieu ne correspond à « {q.trim()} ».</p>}
          {data!.categories.map((c, i) => (
            <a key={c.key} id={`${listId}-${i}`} role="option" aria-selected={active === i} href={categoryHref.replace('__CAT__', c.key)} onClick={(e) => { e.preventDefault(); go(categoryHref.replace('__CAT__', c.key)); }}>
              <span className="suggest-icon"><IconSearch size={16} /></span>
              <span className="grow"><b>{c.label}</b><span className="small muted"> · toutes les offres</span></span>
            </a>
          ))}
          {data!.venues.map((v, j) => {
            const i = data!.categories.length + j;
            return (
              <a key={v.slug} id={`${listId}-${i}`} role="option" aria-selected={active === i} href={`/lieu/${v.slug}`} onClick={(e) => { e.preventDefault(); go(`/lieu/${v.slug}`); }}>
                <span className="suggest-thumb" style={{ background: v.color }}>
                  {v.photoId && <img src={`/api/photos/${v.photoId}?w=160`} alt="" loading="lazy" />}
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{v.name}</b>
                  <span className="small muted" style={{ display: 'block' }}>
                    {v.category} · {v.city}{v.next ? ` · ${v.next}` : ' · pas de créneau pour l’instant'}
                  </span>
                </span>
                {v.best && <span className="deal sm">−{v.best} %</span>}
              </a>
            );
          })}
          {q.trim() && (
            <button type="button" className="suggest-all" onClick={submit}>
              Voir tous les résultats pour « {q.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}
