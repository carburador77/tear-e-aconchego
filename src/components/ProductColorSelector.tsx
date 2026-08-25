'use client';
import { useState } from 'react';
import AddToSelectionButton from '@/components/AddToSelectionButton';
import { sortVariantImages } from '@/lib/product-images';
import type { ProductVariant } from '@/types/catalog';

export default function ProductColorSelector({ image, variants, productId, productName }: { image: string; variants: ProductVariant[]; productId: string; productName: string }) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const selected = variants[selectedVariantIndex];
  const selectedImages = sortVariantImages(selected?.images ?? []);
  const current = selectedImages[selectedImageIndex]?.image_url || image;
  const hasNavigation = selectedImages.length > 1;
  const previous = () => setSelectedImageIndex((index) => (index - 1 + selectedImages.length) % selectedImages.length);
  const next = () => setSelectedImageIndex((index) => (index + 1) % selectedImages.length);
  const selectVariant = (index: number) => {
    setSelectedVariantIndex(index);
    setSelectedImageIndex(0);
  };
  const imageAlt = selected
    ? `${productName} — cor ${selected.color_name} — imagem ${selectedImageIndex + 1}`
    : productName;

  return <div className="min-w-0 max-w-full"><div className="relative max-w-full overflow-hidden"><img className="h-auto max-h-[560px] w-full max-w-full object-contain transition-opacity duration-200" src={current} alt={imageAlt} width={1200} height={1200} decoding="async" fetchPriority="high" />{hasNavigation && <><button type="button" aria-label="Imagem anterior" onClick={previous} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">‹</button><button type="button" aria-label="Próxima imagem" onClick={next} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">›</button><span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#42362d]/75 px-2 py-1 text-xs text-white">{selectedImageIndex + 1} / {selectedImages.length}</span></>}</div>{selectedImages.length > 1 && <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label={`Imagens da cor ${selected?.color_name ?? ''}`}>{selectedImages.map((variantImage, index) => <button key={variantImage.id} type="button" onClick={() => setSelectedImageIndex(index)} aria-label={`Mostrar imagem ${index + 1} de ${selected?.color_name ?? productName}`} aria-current={selectedImageIndex === index ? 'true' : undefined} className={`h-16 w-16 shrink-0 overflow-hidden rounded border bg-[#eee5d8] p-0.5 ${selectedImageIndex === index ? 'ring-2 ring-[#52604a] ring-offset-1' : 'border-[#c6b8a8]'}`}><img src={variantImage.image_url} alt="" width={128} height={128} loading="lazy" decoding="async" className="h-full w-full object-cover" /></button>)}</div>}{selected&&<div className="mt-4"><p className="text-sm">Cor: <strong>{selected.color_name}</strong></p><div className="mt-3 flex flex-wrap gap-3">{variants.map((variant,index)=><button key={variant.id} type="button" title={variant.color_name} aria-label={`Selecionar ${variant.color_name}`} onClick={()=>selectVariant(index)} className={`h-8 w-8 cursor-pointer rounded-full border border-[#8d8173] ${selectedVariantIndex===index?'ring-2 ring-[#52604a] ring-offset-2':''}`} style={{backgroundColor:variant.color_hex}}/>)}</div></div>}<AddToSelectionButton productId={productId} productName={productName} variantId={selected?.id ?? null} variantName={selected?.color_name ?? null} className="mt-5" /></div>;
}
