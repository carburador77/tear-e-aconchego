import type { Metadata } from 'next';
import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';
import { getCategories, getProducts } from '@/lib/catalog';
import ProductSearch from '@/components/ProductSearch';
import { publicMetadata } from '@/lib/seo';

export const metadata: Metadata = publicMetadata({ title: 'Catálogo', description: 'Explore a seleção de peças artesanais da Tear & Aconchego para mesa posta e decoração.', path: '/catalogo' });

export default async function Catalogo({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const query = (await searchParams).q;
  const searchQuery = typeof query === 'string' ? query : '';
  const searchSuffix = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';

  return <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f2eb] text-[#42362d]">
    <PublicHeader active="catalog" />
    <div className="px-6 py-8">
      <h1 className="mb-8 text-center font-serif text-3xl uppercase tracking-widest">Nossas peças</h1>
      <nav aria-label="Categorias" className="mb-8 flex flex-wrap justify-center gap-2">{categories.map((category) => <Link className="border border-[#c6b8a8] px-3 py-2 text-[10px] uppercase" href={`/catalogo/${category.slug}${searchSuffix}`} key={category.id}>{category.name}</Link>)}</nav>
      <ProductSearch products={products} initialQuery={searchQuery} showCategory />
    </div>
    <PublicFooter />
  </main>;
}
