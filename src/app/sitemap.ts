import type { MetadataRoute } from 'next';
import { getSitemapCatalogData } from '@/lib/catalog';
import { absoluteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { categories, subcategories, products } = await getSitemapCatalogData();
  const categorySlugs = new Map(categories.map((category) => [category.id, category.slug]));
  return [
    { url: absoluteUrl('/'), priority: 1 },
    { url: absoluteUrl('/catalogo'), priority: 0.9 },
    ...categories.map((category) => ({ url: absoluteUrl(`/catalogo/${category.slug}`), priority: 0.8 })),
    ...subcategories.flatMap((subcategory) => {
      const categorySlug = categorySlugs.get(subcategory.category_id);
      return categorySlug
        ? [{ url: absoluteUrl(`/catalogo/${categorySlug}?subcategoria=${encodeURIComponent(subcategory.slug)}`), priority: 0.7 }]
        : [];
    }),
    ...products.map((product) => ({ url: absoluteUrl(`/produto/${product.slug}`), priority: 0.7 })),
  ];
}
