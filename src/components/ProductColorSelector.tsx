'use client';
import { useState } from 'react';
import AddToSelectionButton from '@/components/AddToSelectionButton';
import type { ProductVariant } from '@/types/catalog';

export default function ProductColorSelector({ image, variants, productId, productName }: { image: string; variants: ProductVariant[]; productId: string; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = variants[selectedIndex];
  const hasNavigation = variants.length > 1;
  const current = selected?.image_url || image;
  const previous = () => setSelectedIndex((index) => (index - 1 + variants.length) % variants.length);
  const next = () => setSelectedIndex((index) => (index + 1) % variants.length);
  return <div><div className="relative overflow-hidden"><img className="h-auto max-h-[560px] w-full object-contain transition-opacity duration-200" src={current} alt={selected ? `${productName} - ${selected.color_name}` : productName} />{hasNavigation && <><button type="button" aria-label="Imagem anterior" onClick={previous} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">‹</button><button type="button" aria-label="Próxima imagem" onClick={next} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fffdf9]/90 text-2xl text-[#42362d] shadow-sm transition hover:bg-white">›</button><span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#42362d]/75 px-2 py-1 text-xs text-white">{selectedIndex + 1} / {variants.length}</span></>}</div>{selected&&<div className="mt-4"><p className="text-sm">Cor: <strong>{selected.color_name}</strong></p><div className="mt-3 flex gap-3">{variants.map((variant,index)=><button key={variant.id} type="button" title={variant.color_name} aria-label={`Selecionar ${variant.color_name}`} onClick={()=>setSelectedIndex(index)} className={`h-8 w-8 cursor-pointer rounded-full border border-[#8d8173] ${selectedIndex===index?'ring-2 ring-[#52604a] ring-offset-2':''}`} style={{backgroundColor:variant.color_hex}}/>)}</div></div>}<AddToSelectionButton productId={productId} productName={productName} variantId={selected?.id ?? null} variantName={selected?.color_name ?? null} className="mt-5" /></div>;
}
