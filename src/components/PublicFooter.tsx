import Link from 'next/link';
import { getSettings } from '@/lib/catalog';

export default async function PublicFooter() {
  const settings = await getSettings();
  const brand = settings.brand as { name?: string; footer?: string };
  const contact = settings.contact as { whatsappUrl?: string };
  const social = settings.social as { instagramUrl?: string } | undefined;
  const instagramUrl = social?.instagramUrl?.trim();
  const hasInstagram = /^https?:\/\//i.test(instagramUrl ?? '');

  return <footer className="bg-[#e1d0b6] px-7 py-10 text-sm md:px-16 lg:px-20">
    <div className="mx-auto max-w-6xl"><div className="grid gap-8 md:grid-cols-[1.5fr_.7fr_.8fr]"><section><Link href="/" className="font-serif text-2xl focus:outline-none focus:ring-2 focus:ring-[#52604a]">{brand.name ?? 'Tear & Aconchego'}</Link><p className="mt-3 max-w-sm leading-relaxed">Peças artesanais feitas para transformar detalhes em aconchego.</p>{brand.footer && <p className="mt-3 text-xs">{brand.footer}</p>}</section><nav aria-label="Navegação do rodapé"><h2 className="text-xs font-bold uppercase tracking-wide">Navegação</h2><div className="mt-3 flex flex-col items-start gap-2"><Link href="/" className="rounded py-1 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">Início</Link><Link href="/catalogo" className="rounded py-1 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">Catálogo</Link></div></nav><section><h2 className="text-xs font-bold uppercase tracking-wide">Contato</h2><div className="mt-3 flex flex-col items-start gap-2"><a href={contact.whatsappUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="rounded py-1 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">WhatsApp ↗</a>{hasInstagram && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="rounded py-1 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">Instagram ↗</a>}</div></section></div><div className="mt-8 border-t border-[#c8b797] pt-4 text-xs">© {new Date().getFullYear()} {brand.name ?? 'Tear & Aconchego'}</div></div>
  </footer>;
}
