import { isVariantImagesSchemaUnavailable } from '@/lib/product-images';
import { removeImage } from '@/lib/supabase/storage';
import { createClient } from '@/lib/supabase/client';

function containsValue(value: unknown, expected: string): boolean {
  if (value === expected) return true;
  if (Array.isArray(value)) return value.some((item) => containsValue(item, expected));
  if (value && typeof value === 'object') return Object.values(value).some((item) => containsValue(item, expected));
  return false;
}

export async function removeCatalogImageIfUnused(url?: string | null) {
  if (!url) return false;
  const supabase = createClient();
  const [variantImages, variants, products, categories, settings] = await Promise.all([
    supabase.from('product_variant_images').select('id', { count: 'exact', head: true }).eq('image_url', url),
    supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('image_url', url),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('image_url', url),
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('image_url', url),
    supabase.from('site_settings').select('value'),
  ]);

  const variantImagesError = variantImages.error && !isVariantImagesSchemaUnavailable(variantImages.error) ? variantImages.error : null;
  const error = variantImagesError ?? variants.error ?? products.error ?? categories.error ?? settings.error;
  if (error) throw error;

  const referenceCount = (variantImages.error ? 0 : variantImages.count ?? 0)
    + (variants.count ?? 0)
    + (products.count ?? 0)
    + (categories.count ?? 0);
  const usedBySettings = (settings.data ?? []).some((setting) => containsValue(setting.value, url));
  if (referenceCount > 0 || usedBySettings) return false;

  await removeImage(url);
  return true;
}
