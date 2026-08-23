import Link from 'next/link';
import CategorySubcategoryNavigation from '@/components/CategorySubcategoryNavigation';
import PublicFooter from '@/components/PublicFooter';
import ProductSearch from '@/components/ProductSearch';
import PublicHeader from '@/components/PublicHeader';
import { getCategories, getProducts, getSubcategories } from '@/lib/catalog';

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ subcategoria?: string | string[]; q?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  const subcategories = category ? await getSubcategories(category.id) : [];
  const requestedSubcategory = typeof query.subcategoria === 'string' ? query.subcategoria : '';
  const searchQuery = typeof query.q === 'string' ? query.q : '';
  const selectedSubcategory = subcategories.find((item) => item.slug === requestedSubcategory);
  const products = await getProducts(slug, selectedSubcategory?.id);

  return <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f2eb] text-[#42362d]">
    <PublicHeader active="catalog" />
    <div className="px-6 py-8">
      <Link href={`/catalogo${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}>← Todas as peças</Link>
      <h1 className="mb-5 mt-8 text-center font-serif text-3xl">Peças da categoria</h1>
      {category && <CategorySubcategoryNavigation categories={categories} category={category} subcategories={subcategories} selectedSubcategory={selectedSubcategory} searchQuery={searchQuery} />}
      {products.length > 0 ? <ProductSearch products={products} initialQuery={searchQuery} /> : <p className="py-14 text-center text-sm text-[#6e6254]">{selectedSubcategory ? 'Nenhuma peça encontrada nesta subcategoria.' : 'Nenhuma peça encontrada nesta categoria.'}</p>}
    </div>
    <PublicFooter />
  </main>;
}
