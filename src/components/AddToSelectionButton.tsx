'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSelection } from '@/components/SelectionProvider';
import { MAX_SELECTION_LINES, selectionItemKey } from '@/lib/selection';

export default function AddToSelectionButton({ productId, productName, variantId, variantName, className = '' }: { productId: string; productName: string; variantId?: string | null; variantName?: string | null; className?: string }) {
  const { addItem, hydrated, items } = useSelection();
  const [feedback, setFeedback] = useState<'added' | 'limit' | null>(null);
  const accessibleName = `Adicionar ${productName}${variantName ? `, cor ${variantName}` : ''} à minha seleção`;
  const itemAlreadyExists = items.some((item) => selectionItemKey(item.productId, item.variantId) === selectionItemKey(productId, variantId));

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return <div className={className}>
    <button type="button" aria-label={accessibleName} disabled={!hydrated} onClick={() => { if (!itemAlreadyExists && items.length >= MAX_SELECTION_LINES) { setFeedback('limit'); return; } addItem(productId, variantId); setFeedback('added'); }} className="w-full rounded border border-[#52604a] px-3 py-2 text-xs font-semibold text-[#52604a] transition hover:bg-[#52604a] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">Adicionar à minha seleção</button>
    {feedback === 'added' && <p role="status" aria-live="polite" className="mt-2 text-xs text-[#52604a]">Adicionado à sua seleção. <Link href="/minha-selecao" className="font-semibold underline underline-offset-2">Ver minha seleção</Link></p>}
    {feedback === 'limit' && <p role="status" aria-live="polite" className="mt-2 text-xs text-[#7b4f2d]">Sua seleção atingiu o limite de {MAX_SELECTION_LINES} opções. Remova uma opção para adicionar outra.</p>}
  </div>;
}
