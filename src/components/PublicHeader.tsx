import Link from 'next/link';
import { getSettings } from '@/lib/catalog';
import SelectionHeaderLink from '@/components/SelectionHeaderLink';

type PublicHeaderProps = { active?: 'home' | 'catalog' | 'selection' };

export default async function PublicHeader({ active }: PublicHeaderProps) {
  const settings = await getSettings();
  const { brand, contact } = settings;
  const linkClass = (section: PublicHeaderProps['active']) => `catalog-header-link rounded px-1 py-1 transition focus:outline-none focus:ring-2 focus:ring-[var(--catalog-header-nav-active)] ${active === section ? 'font-semibold underline underline-offset-4' : 'hover:underline hover:underline-offset-4'}`;

  return <header className="catalog-header">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3 md:px-8 md:py-4">
      <Link href="/" className="catalog-header-brand font-serif text-xl focus:outline-none focus:ring-2 focus:ring-[var(--catalog-header-nav-active)] md:text-2xl">{brand.name}</Link>
      <a className="catalog-header-whatsapp rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--catalog-header-nav-active)] md:order-3 md:text-base" href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
      <nav aria-label="Navegação principal" className="order-3 flex w-full items-center gap-4 text-xs md:order-2 md:w-auto md:gap-6 md:text-sm">
        <Link href="/" aria-current={active === 'home' ? 'page' : undefined} className={linkClass('home')}>Início</Link>
        <Link href="/catalogo" aria-current={active === 'catalog' ? 'page' : undefined} className={linkClass('catalog')}>Catálogo</Link>
        <SelectionHeaderLink active={active === 'selection'} className={linkClass('selection')} />
      </nav>
    </div>
  </header>;
}
