'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Category, Subcategory } from '@/types/catalog';

export default function CategorySubcategoryNavigation({ categories, category, subcategories, selectedSubcategory, searchQuery = '' }: { categories: Category[]; category: Category; subcategories: Subcategory[]; selectedSubcategory?: Subcategory; searchQuery?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const categoryMenu = useRef<HTMLDetailsElement>(null);
  const subcategoryMenu = useRef<HTMLDetailsElement>(null);
  const closeMenus = () => { categoryMenu.current?.removeAttribute('open'); subcategoryMenu.current?.removeAttribute('open'); };

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) closeMenus(); };
    const closeWithKeyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenus(); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithKeyboard);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeWithKeyboard); };
  }, []);

  const categoryHref = (slug: string) => `/catalogo/${slug}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`;
  const subcategoryHref = (subcategorySlug?: string) => { const params = new URLSearchParams(); if (subcategorySlug) params.set('subcategoria', subcategorySlug); if (searchQuery) params.set('q', searchQuery); return `/catalogo/${category.slug}${params.size ? `?${params.toString()}` : ''}`; };
  return <div ref={container} aria-label="Navegação de categoria e subcategoria" className="relative mx-auto mb-8 flex max-w-full flex-wrap items-start justify-center gap-x-3 gap-y-2 text-sm text-[#42362d]">
    <details ref={categoryMenu} className="group relative" onToggle={() => { if (categoryMenu.current?.open) subcategoryMenu.current?.removeAttribute('open'); }}>
      <summary className="flex max-w-[75vw] cursor-pointer list-none items-center gap-1 border-b border-[#c6b8a8] px-1 py-1 font-medium [&::-webkit-details-marker]:hidden"><span className="truncate">{category.name}</span><span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">⌄</span></summary>
      <div className="absolute left-0 z-20 mt-2 min-w-48 max-w-[calc(100vw-3rem)] overflow-hidden rounded border border-[#d7cabc] bg-[#f7f2eb] shadow-lg">{categories.map((item) => <Link key={item.id} href={categoryHref(item.slug)} aria-current={item.id === category.id ? 'page' : undefined} className={`block truncate px-4 py-2.5 hover:bg-[#ece3d8] ${item.id === category.id ? 'font-semibold text-[#52604a]' : ''}`}>{item.name}</Link>)}</div>
    </details>
    <span aria-hidden="true" className="py-1 text-[#8b7d6d]">&gt;</span>
    <details ref={subcategoryMenu} className="group relative" onToggle={() => { if (subcategoryMenu.current?.open) categoryMenu.current?.removeAttribute('open'); }}>
      <summary className="flex max-w-[75vw] cursor-pointer list-none items-center gap-1 border-b border-[#c6b8a8] px-1 py-1 font-medium [&::-webkit-details-marker]:hidden"><span className="truncate">{selectedSubcategory?.name ?? 'Todas as peças'}</span><span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">⌄</span></summary>
      <div className="absolute right-0 z-20 mt-2 min-w-48 max-w-[calc(100vw-3rem)] overflow-hidden rounded border border-[#d7cabc] bg-[#f7f2eb] shadow-lg"><Link href={subcategoryHref()} aria-current={!selectedSubcategory ? 'page' : undefined} className={`block truncate px-4 py-2.5 hover:bg-[#ece3d8] ${!selectedSubcategory ? 'font-semibold text-[#52604a]' : ''}`}>Todas as peças</Link>{subcategories.map((item) => <Link key={item.id} href={subcategoryHref(item.slug)} aria-current={item.id === selectedSubcategory?.id ? 'page' : undefined} className={`block truncate px-4 py-2.5 hover:bg-[#ece3d8] ${item.id === selectedSubcategory?.id ? 'font-semibold text-[#52604a]' : ''}`}>{item.name}</Link>)}</div>
    </details>
  </div>;
}
