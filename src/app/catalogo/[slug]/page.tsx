import type { Metadata } from 'next';
import Link from 'next/link';
import CategorySubcategoryNavigation from '@/components/CategorySubcategoryNavigation';
import PublicFooter from '@/components/PublicFooter';
import ProductSearch from '@/components/ProductSearch';
import PublicHeader from '@/components/PublicHeader';
import { getCategories, getProducts, getSubcategories } from '@/lib/catalog';
import { metadataDescription, publicMetadata } from '@/lib/seo';

type CategoryRouteProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ subcategoria?: string | string[]; q?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: CategoryRouteProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) return publicMetadata({ title: 'Catálogo', description: 'Explore a seleção de peças artesanais da Tear & Aconchego para mesa posta e decoração.', path: '/catalogo' });

  const requestedSubcategory = typeof query.subcategoria === 'string' ? query.subcategoria : '';
  const subcategories = requestedSubcategory ? await getSubcategories(category.id) : [];
  const subcategory = subcategories.find((item) => item.slug === requestedSubcategory);
  const title = subcategory ? `${subcategory.name} | ${category.name}` : category.name;
  const description = subcategory ? `Conheça as peças de ${subcategory.name} na categoria ${category.name} da Tear & Aconchego.` : metadataDescription(category.description, `Conheça as peças da categoria ${category.name} da Tear & Aconchego.`);
  const path = subcategory ? `/catalogo/${category.slug}?subcategoria=${encodeURIComponent(subcategory.slug)}` : `/catalogo/${category.slug}`;
  return publicMetadata({ title, description, path, image: category.image_url });
}

export default async function CategoryPage({ params, searchParams }: CategoryRouteProps) {
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
