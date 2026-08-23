import Link from 'next/link';
import CategorySubcategoryNavigation from '@/components/CategorySubcategoryNavigation';
import ProductCatalogCard from '@/components/ProductCatalogCard';
import PublicHeader from '@/components/PublicHeader';
import { getCategories, getProducts, getSubcategories } from '@/lib/catalog';

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ subcategoria?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  const subcategories = category ? await getSubcategories(category.id) : [];
  const requestedSubcategory = typeof query.subcategoria === 'string' ? query.subcategoria : '';
  const selectedSubcategory = subcategories.find((item) => item.slug === requestedSubcategory);
  const products = await getProducts(slug, selectedSubcategory?.id);

  return <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f2eb] text-[#42362d]">
    <PublicHeader active="catalog" />
    <div className="px-6 py-8">
      <Link href="/catalogo">← Todas as peças</Link>
      <h1 className="mb-5 mt-8 text-center font-serif text-3xl">Peças da categoria</h1>
      {category && <CategorySubcategoryNavigation categories={categories} category={category} subcategories={subcategories} selectedSubcategory={selectedSubcategory} />}
      {products.length > 0 ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCatalogCard product={product} key={product.id} />)}</div> : <p className="py-14 text-center text-sm text-[#6e6254]">{selectedSubcategory ? 'Nenhuma peça encontrada nesta subcategoria.' : 'Nenhuma peça encontrada nesta categoria.'}</p>}
    </div>
  </main>;
}
