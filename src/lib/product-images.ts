import type { ProductVariant, ProductVariantImage } from '@/types/catalog';

export const MAX_VARIANT_IMAGES = 8;

export function sortVariantImages(images: ProductVariantImage[]) {
  return [...images].sort((first, second) => {
    if (first.is_primary !== second.is_primary) return first.is_primary ? -1 : 1;
    if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
    return (first.created_at ?? '').localeCompare(second.created_at ?? '');
  });
}

export function primaryVariantImage(variant?: Pick<ProductVariant, 'images'> | null) {
  return sortVariantImages(variant?.images ?? [])[0] ?? null;
}

export function variantImageUrls(variant?: Pick<ProductVariant, 'images'> | null) {
  return sortVariantImages(variant?.images ?? []).map((image) => image.image_url);
}

export function legacyVariantImage(variant: Pick<ProductVariant, 'id' | 'image_url'>): ProductVariantImage[] {
  if (!variant.image_url) return [];
  return [{
    id: `legacy-${variant.id}`,
    product_variant_id: variant.id,
    image_url: variant.image_url,
    sort_order: 0,
    is_primary: true,
  }];
}

export function isVariantImagesSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('product_variant_images') && (message.includes('schema cache') || message.includes('does not exist'));
}
