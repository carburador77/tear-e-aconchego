'use client';

import Link from 'next/link';
import { useSelection } from '@/components/SelectionProvider';

export default function SelectionHeaderLink({ className, active }: { className: string; active?: boolean }) {
  const { hydrated, lineCount } = useSelection();
  return <Link href="/minha-selecao" aria-current={active ? 'page' : undefined} className={className}>Minha Seleção ({hydrated ? lineCount : 0})</Link>;
}
