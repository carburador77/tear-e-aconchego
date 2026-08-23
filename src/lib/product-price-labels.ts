import type { CatalogProduct, Product } from '@/types/catalog';

export type LegacyPriceLabels = Record<string, string>;

export function addCustomPriceText(products: Product[], labels: LegacyPriceLabels): CatalogProduct[] {
  return products.map((product) => ({
    ...product,
    custom_price_text: labels[product.id] ?? null,
  }));
}
