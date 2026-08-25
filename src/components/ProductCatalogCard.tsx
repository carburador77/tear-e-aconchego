'use client';

import Link from 'next/link';
import { useState } from 'react';
import AddToSelectionButton from '@/components/AddToSelectionButton';
import { sortVariantImages } from '@/lib/product-images';
import { formatProductPrice } from '@/lib/price';
import type { CatalogProduct } from '@/types/catalog';

export default function ProductCatalogCard({ product, showCategory = false }: { product: CatalogProduct; showCategory?: boolean }) {
  const variants = product.variants ?? [];
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const selected = variants[selectedVariantIndex];
  const selectedImages = sortVariantImages(selected?.images ?? []);
  const hasNavigation = selectedImages.length > 1;
  const selectPrevious = () => setSelectedImageIndex((index) => (index - 1 + selectedImages.length) % selectedImages.length);
  const selectNext = () => setSelectedImageIndex((index) => (index + 1) % selectedImages.length);
  const selectVariant = (index: number) => {
    setSelectedVariantIndex(index);
    setSelectedImageIndex(0);
  };
  const image = selectedImages[selectedImageIndex]?.image_url ?? product.image_url ?? '';
  const imageAlt = selected
    ? `${product.name} — cor ${selected.color_name} — imagem ${selectedImageIndex + 1}`
    : product.name;

  return <article className="group">
    <div className="relative overflow-hidden">
      <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.name}`}>
        <img className="h-80 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" src={image} alt={imageAlt} width={800} height={800} loading="lazy" decoding="async" />
      </Link>
      {hasNavigation && <>
        <button type="button" aria-label={`Imagem anterior de ${selected?.color_name ?? product.name}`} onClick={selectPrevious} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">‹</button>
        <button type="button" aria-label={`Próxima imagem de ${selected?.color_name ?? product.name}`} onClick={selectNext} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">›</button>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#42362d]/75 px-2 py-1 text-xs text-white">{selectedImageIndex + 1} / {selectedImages.length}</span>
      </>}
    </div>
    {variants.length > 0 && <div className="mt-3 flex gap-2" aria-label="Cores disponíveis">{variants.map((variant, index) => <button key={variant.id} type="button" title={variant.color_name} aria-label={`Selecionar ${variant.color_name}`} onClick={() => selectVariant(index)} className={`h-5 w-5 rounded-full border border-[#8d8173] ${selectedVariantIndex === index ? 'ring-2 ring-[#52604a] ring-offset-2' : ''}`} style={{ backgroundColor: variant.color_hex }} />)}</div>}
    <Link href={`/produto/${product.slug}`} className="block">
      {showCategory && <p className="mt-3 text-[10px] uppercase tracking-wide text-[#766d63]">{product.categories?.name}</p>}
      <h2 className="catalog-card-name mt-2 font-serif text-xl leading-tight">{product.name}</h2>
      {product.description?.trim() && <p className="catalog-card-description mt-2 text-sm leading-relaxed text-[#5f5549]">{product.description}</p>}
      <strong className="mt-2 block font-serif">{formatProductPrice(product.price, product.custom_price_text)}</strong>
    </Link>
    <AddToSelectionButton productId={product.id} productName={product.name} variantId={selected?.id ?? null} variantName={selected?.color_name ?? null} className="mt-3" />
  </article>;
}
