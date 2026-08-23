import type { MetadataRoute } from 'next';
import { getCategories, getProducts, getSubcategories } from '@/lib/catalog';
import { absoluteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const subcategoryGroups = await Promise.all(categories.map(async (category) => ({ category, subcategories: await getSubcategories(category.id) })));
  return [
    { url: absoluteUrl('/'), priority: 1 },
    { url: absoluteUrl('/catalogo'), priority: 0.9 },
    ...categories.map((category) => ({ url: absoluteUrl(`/catalogo/${category.slug}`), priority: 0.8 })),
    ...subcategoryGroups.flatMap(({ category, subcategories }) => subcategories.map((subcategory) => ({ url: absoluteUrl(`/catalogo/${category.slug}?subcategoria=${encodeURIComponent(subcategory.slug)}`), priority: 0.7 }))),
    ...products.map((product) => ({ url: absoluteUrl(`/produto/${product.slug}`), priority: 0.7 })),
  ];
}
