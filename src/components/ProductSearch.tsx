'use client';

import { useEffect, useMemo, useState } from 'react';
import ProductCatalogCard from '@/components/ProductCatalogCard';
import type { CatalogProduct } from '@/types/catalog';

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

type ProductSearchProps = { products: CatalogProduct[]; initialQuery?: string; showCategory?: boolean; whatsappNumber?: string | null };

export default function ProductSearch({ products, initialQuery = '', showCategory = false, whatsappNumber }: ProductSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const normalizedQuery = normalizeSearchText(query);
  const filteredProducts = useMemo(() => normalizedQuery ? products.filter((product) => normalizeSearchText(product.name).includes(normalizedQuery)) : products, [normalizedQuery, products]);

  useEffect(() => {
    const updateFromBrowser = () => setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    window.addEventListener('popstate', updateFromBrowser);
    return () => window.removeEventListener('popstate', updateFromBrowser);
  }, []);

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const params = new URLSearchParams(window.location.search);
    if (nextQuery.trim()) params.set('q', nextQuery); else params.delete('q');
    const target = `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}`;
    window.history.replaceState(window.history.state, '', target);
  };

  const clearSearch = () => updateQuery('');

  return <>
    <div className="mx-auto mb-8 max-w-xl">
      <label htmlFor="product-search" className="sr-only">Buscar uma peça</label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#766d63]">⌕</span>
        <input id="product-search" type="search" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Buscar uma peça..." className="w-full rounded-full border-[#c6b8a8] bg-[#fffdf9] py-3 pl-11 pr-12 text-sm shadow-sm" />
        {query && <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-xl text-[#5f5549] transition hover:bg-[#ece3d8] focus:outline-none focus:ring-2 focus:ring-[#52604a]" aria-label="Limpar busca">×</button>}
      </div>
      {query && <p className="mt-3 text-center text-sm" role="status">{filteredProducts.length === 1 ? '1 peça encontrada' : `${filteredProducts.length} peças encontradas`}</p>}
    </div>

    {filteredProducts.length > 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <ProductCatalogCard product={product} showCategory={showCategory} whatsappNumber={whatsappNumber} key={product.id} />)}</div> : <div className="py-14 text-center"><p className="font-serif text-xl">Nenhuma peça encontrada para “{query}”.</p><p className="mt-2 text-sm text-[#6e6254]">Tente outro nome ou explore nossas categorias.</p><button type="button" onClick={clearSearch} className="mt-5 underline underline-offset-4">Limpar busca</button></div>}
  </>;
}
