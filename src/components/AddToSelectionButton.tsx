'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSelection } from '@/components/SelectionProvider';

export default function AddToSelectionButton({ productId, productName, variantId, variantName, className = '' }: { productId: string; productName: string; variantId?: string | null; variantName?: string | null; className?: string }) {
  const { addItem, hydrated } = useSelection();
  const [added, setAdded] = useState(false);
  const accessibleName = `Adicionar ${productName}${variantName ? `, cor ${variantName}` : ''} à minha seleção`;

  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [added]);

  return <div className={className}>
    <button type="button" aria-label={accessibleName} disabled={!hydrated} onClick={() => { addItem(productId, variantId); setAdded(true); }} className="w-full rounded border border-[#52604a] px-3 py-2 text-xs font-semibold text-[#52604a] transition hover:bg-[#52604a] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">Adicionar à minha seleção</button>
    {added && <p role="status" aria-live="polite" className="mt-2 text-xs text-[#52604a]">Adicionado à sua seleção. <Link href="/minha-selecao" className="font-semibold underline underline-offset-2">Ver minha seleção</Link></p>}
  </div>;
}
