import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import { getCategories, getProducts } from '@/lib/catalog';
import ProductCatalogCard from '@/components/ProductCatalogCard';

export default async function Catalogo() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f2eb] text-[#42362d]">
    <PublicHeader active="catalog" />
    <div className="px-6 py-8">
      <h1 className="mb-8 text-center font-serif text-3xl uppercase tracking-widest">Nossas peças</h1>
      <nav aria-label="Categorias" className="mb-8 flex flex-wrap justify-center gap-2">{categories.map((category) => <Link className="border border-[#c6b8a8] px-3 py-2 text-[10px] uppercase" href={`/catalogo/${category.slug}`} key={category.id}>{category.name}</Link>)}</nav>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCatalogCard product={product} showCategory key={product.id} />)}</div>
    </div>
  </main>;
}
