export type Category = { id: string; name: string; slug: string; description: string; image_url: string | null; display_order: number; active: boolean; updated_at?: string };
export type Subcategory = { id: string; category_id: string; name: string; slug: string; active: boolean; updated_at?: string };
export type Product = { id: string; category_id: string; subcategory_id: string | null; name: string; slug: string; description: string; price: number | null; image_url: string | null; origin: string | null; dimensions: string | null; care: string | null; whatsapp_url: string | null; display_order: number; active: boolean; updated_at?: string; categories?: Pick<Category, 'name' | 'slug'> | null; variants?: ProductVariant[] };
export type CatalogProduct = Product & { custom_price_text: string | null };
export type Benefit = { id: string; icon: string; title: string; description: string; display_order: number; active: boolean; updated_at?: string };
export type SiteSettings = Record<string, unknown>;
export type ProductVariantImage = { id: string; product_variant_id: string; image_url: string; sort_order: number; is_primary: boolean; created_at?: string; updated_at?: string };
export type ProductVariant = { id: string; product_id: string; color_name: string; color_hex: string; image_url: string | null; display_order: number; active: boolean; is_default: boolean; updated_at?: string; images: ProductVariantImage[] };
