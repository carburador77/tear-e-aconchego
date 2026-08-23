'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatProductPrice } from '@/lib/price';
import type { Product } from '@/types/catalog';

export default function ProductCatalogCard({ product, showCategory = false }: { product: Product; showCategory?: boolean }) {
  const variants = product.variants ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = variants[selectedIndex];
  const hasNavigation = variants.length > 1;
  const selectPrevious = () => setSelectedIndex((index) => (index - 1 + variants.length) % variants.length);
  const selectNext = () => setSelectedIndex((index) => (index + 1) % variants.length);
  const image = selected?.image_url ?? product.image_url ?? '';

  return <article className="group">
    <div className="relative overflow-hidden">
      <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <img className="h-80 w-full object-cover transition-opacity duration-200 group-hover:scale-[1.02]" src={image} alt={selected ? `${product.name} - ${selected.color_name}` : product.name} />
      </Link>
      {hasNavigation && <>
        <button type="button" aria-label="Ver cor anterior" onClick={selectPrevious} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">‹</button>
        <button type="button" aria-label="Ver próxima cor" onClick={selectNext} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">›</button>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#42362d]/75 px-2 py-1 text-xs text-white">{selectedIndex + 1} / {variants.length}</span>
      </>}
    </div>
    {variants.length > 0 && <div className="mt-3 flex gap-2" aria-label="Cores disponíveis">{variants.map((variant, index) => <button key={variant.id} type="button" title={variant.color_name} aria-label={`Selecionar ${variant.color_name}`} onClick={() => setSelectedIndex(index)} className={`h-5 w-5 rounded-full border border-[#8d8173] ${selectedIndex === index ? 'ring-2 ring-[#52604a] ring-offset-2' : ''}`} style={{ backgroundColor: variant.color_hex }} />)}</div>}
    <Link href={`/produto/${product.slug}`} className="block">
      {showCategory && <p className="mt-3 text-[10px] uppercase tracking-wide text-[#766d63]">{product.categories?.name}</p>}
      <h2 className="catalog-card-name mt-2 font-serif text-xl leading-tight">{product.name}</h2>
      {product.description?.trim() && <p className="catalog-card-description mt-2 text-sm leading-relaxed text-[#5f5549]">{product.description}</p>}
      <strong className="mt-2 block font-serif">{formatProductPrice(product.price, product.price_label)}</strong>
    </Link>
  </article>;
}
