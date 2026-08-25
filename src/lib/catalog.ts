import { createClient } from '@/lib/supabase/server';
import type { Benefit, CatalogProduct, Category, Product, ProductVariant, ProductVariantImage, Subcategory } from '@/types/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { DEFAULT_WHATSAPP_NUMBER, normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { sortProductsAlphabetically } from '@/lib/product-utils';
import { addCustomPriceText, type LegacyPriceLabels } from '@/lib/product-price-labels';
import { cache } from 'react';
import { isVariantImagesSchemaUnavailable, legacyVariantImage, sortVariantImages } from '@/lib/product-images';

type SettingsObject = Record<string, unknown>;

export type CatalogSettings = SettingsObject & {
  brand: { name: string; tagline: string; footer: string };
  hero: { title: string; description: string; buttonText: string; imageUrl: string };
  contact: { whatsappUrl: string; whatsappNumber: string; phone: string };
  social: { instagramUrl: string };
  theme: {
    forest: string;
    cream: string;
    sand: string;
    clay: string;
    text: string;
    textMuted: string;
    textOnDark: string;
    brandText: string;
    buttonText: string;
    headerBackground: string;
    headerNavText: string;
    headerNavActive: string;
    headerNavHover: string;
    headerWhatsappText: string;
  };
};

export type SitemapCatalogData = {
  categories: Array<{ id: string; slug: string }>;
  subcategories: Array<{ category_id: string; slug: string }>;
  products: Array<{ slug: string }>;
};

const configured = hasSupabaseEnv;
const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&q=85';
const DEFAULT_THEME = {
  forest: '#52604a',
  cream: '#f5f0e8',
  sand: '#e7dbca',
  clay: '#997245',
  text: '#39362f',
  textMuted: '#766d63',
  textOnDark: '#f6f0e7',
  brandText: '#f6f0e7',
  buttonText: '#ffffff',
  headerBackground: '#52604a',
  headerNavText: '#ffffff',
  headerNavActive: '#ffffff',
  headerNavHover: '#ffffff',
  headerWhatsappText: '#ffffff',
};

const categories: Category[] = [
  {
    id: 'mantas',
    name: 'Mantas e Peseiras',
    slug: 'mantas-e-peseiras',
    description: 'Conforto e elegância para todos os ambientes.',
    image_url: 'https://images.unsplash.com/photo-1583845112203-454c57d86011?auto=format&fit=crop&w=900&q=85',
    display_order: 1,
    active: true,
  },
  {
    id: 'almofadas',
    name: 'Almofadas',
    slug: 'almofadas',
    description: 'Texturas que abraçam e transformam seu espaço.',
    image_url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=85',
    display_order: 2,
    active: true,
  },
];

const products: Product[] = [
  {
    id: 'coberta-la-natural',
    category_id: 'mantas',
    subcategory_id: null,
    name: 'Coberta Lã Natural',
    slug: 'coberta-la-natural',
    description: 'Coberta em tons naturais que combina com qualquer ambiente. Conforto e elegância para todos os ambientes da casa.',
    price: 229,
    image_url: 'https://images.unsplash.com/photo-1583845112203-454c57d86011?auto=format&fit=crop&w=1000&q=85',
    origin: '100% fio têxtil natural, feito à mão',
    dimensions: 'Sob encomenda',
    care: 'Lavar à mão em água fria. Secar à sombra.',
    whatsapp_url: null,
    display_order: 1,
    active: true,
    categories: { name: 'Mantas e Peseiras', slug: 'mantas-e-peseiras' },
  },
  {
    id: 'manta-trico-creme',
    category_id: 'mantas',
    subcategory_id: null,
    name: 'Manta Tricô Creme',
    slug: 'manta-trico-creme',
    description: 'Manta de tricô em fio creme, macia e aconchegante.',
    price: 189,
    image_url: 'https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=1000&q=85',
    origin: '100% fio têxtil natural, tricô artesanal manual',
    dimensions: '130 x 170 cm',
    care: 'Lavar à mão em água fria. Secar à sombra na horizontal.',
    whatsapp_url: null,
    display_order: 2,
    active: true,
    categories: { name: 'Mantas e Peseiras', slug: 'mantas-e-peseiras' },
  },
];

function asObject(value: unknown): SettingsObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as SettingsObject : {};
}

function settingText(object: SettingsObject, key: string, fallback: string, allowEmpty = true) {
  const value = object[key];
  if (typeof value !== 'string') return fallback;
  return allowEmpty || value.trim() ? value : fallback;
}

function settingColor(object: SettingsObject, key: string, fallback: string) {
  const value = object[key];
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeHttpUrl(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function normalizeSettings(raw: SettingsObject): CatalogSettings {
  const brand = asObject(raw.brand);
  const hero = asObject(raw.hero);
  const contact = asObject(raw.contact);
  const social = asObject(raw.social);
  const theme = asObject(raw.theme);
  const whatsappNumber = normalizeWhatsAppNumber(
    settingText(contact, 'whatsappNumber', settingText(contact, 'whatsappUrl', DEFAULT_WHATSAPP_NUMBER)),
  );

  const forest = settingColor(theme, 'forest', DEFAULT_THEME.forest);
  const cream = settingColor(theme, 'cream', DEFAULT_THEME.cream);
  const sand = settingColor(theme, 'sand', DEFAULT_THEME.sand);
  const clay = settingColor(theme, 'clay', DEFAULT_THEME.clay);
  const text = settingColor(theme, 'text', DEFAULT_THEME.text);
  const textMuted = settingColor(theme, 'textMuted', DEFAULT_THEME.textMuted);
  const textOnDark = settingColor(theme, 'textOnDark', DEFAULT_THEME.textOnDark);
  const brandText = settingColor(theme, 'brandText', DEFAULT_THEME.brandText);
  const buttonText = settingColor(theme, 'buttonText', DEFAULT_THEME.buttonText);

  return {
    ...raw,
    brand: {
      name: settingText(brand, 'name', 'Tear & Aconchego', false),
      tagline: settingText(brand, 'tagline', 'ARTE EM CADA DETALHE'),
      footer: settingText(brand, 'footer', 'Tear & Aconchego – Arte em cada detalhe'),
    },
    hero: {
      title: settingText(hero, 'title', 'Feito à mão. Pensado para acolher.', false),
      description: settingText(hero, 'description', 'Peças artesanais que levam beleza, aconchego e personalidade para o seu lar.'),
      buttonText: settingText(hero, 'buttonText', 'CONHEÇA O CATÁLOGO', false),
      imageUrl: safeHttpUrl(hero.imageUrl, DEFAULT_HERO_IMAGE),
    },
    contact: {
      whatsappNumber,
      whatsappUrl: `https://wa.me/${whatsappNumber}`,
      phone: settingText(contact, 'phone', '(47) 99999-9999'),
    },
    social: {
      instagramUrl: settingText(social, 'instagramUrl', ''),
    },
    theme: {
      forest,
      cream,
      sand,
      clay,
      text,
      textMuted,
      textOnDark,
      brandText,
      buttonText,
      headerBackground: settingColor(theme, 'headerBackground', forest),
      headerNavText: settingColor(theme, 'headerNavText', buttonText),
      headerNavActive: settingColor(theme, 'headerNavActive', buttonText),
      headerNavHover: settingColor(theme, 'headerNavHover', buttonText),
      headerWhatsappText: settingColor(theme, 'headerWhatsappText', buttonText),
    },
  };
}

export function getDefaultSettings(): CatalogSettings {
  return normalizeSettings({});
}

function catalogQueryError(resource: string, cause: unknown): never {
  throw new Error(`Não foi possível carregar ${resource}.`, { cause });
}

export const getSettings = cache(async (): Promise<CatalogSettings> => {
  if (!configured) return getDefaultSettings();

  const supabase = await createClient();
  const { data, error } = await supabase.from('site_settings').select('key,value');
  if (error) catalogQueryError('as configurações do catálogo', error);

  const raw = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return normalizeSettings(raw);
});

export async function getCategories(): Promise<Category[]> {
  if (!configured) return categories;

  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').eq('active', true).order('display_order');
  if (error) catalogQueryError('as categorias', error);
  return (data ?? []) as Category[];
}

export async function getSubcategories(categoryId: string): Promise<Subcategory[]> {
  if (!configured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('name');
  if (error) catalogQueryError('as subcategorias', error);
  return sortProductsAlphabetically((data ?? []) as Subcategory[]);
}

export async function getBenefits(): Promise<Benefit[]> {
  if (!configured) {
    return [
      { id: '1', icon: '♡', title: 'Produção artesanal', description: 'Feito à mão com amor e dedicação', display_order: 1, active: true },
      { id: '2', icon: '◌', title: 'Materiais premium', description: 'Selecionamos os melhores materiais para você', display_order: 2, active: true },
    ];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('benefits').select('*').eq('active', true).order('display_order');
  if (error) catalogQueryError('os diferenciais da marca', error);
  return (data ?? []) as Benefit[];
}

async function getPriceLabels(): Promise<LegacyPriceLabels> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle();
  if (error) catalogQueryError('os textos de preço', error);

  const value = asObject(data?.value);
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

type ProductVariantRow = Omit<ProductVariant, 'images'>;

async function getImagesForVariants(variants: ProductVariantRow[]) {
  const variantIds = variants.map((variant) => variant.id);
  if (!variantIds.length) return new Map<string, ProductVariantImage[]>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_variant_images')
    .select('*')
    .in('product_variant_id', variantIds)
    .order('is_primary', { ascending: false })
    .order('sort_order')
    .order('created_at');

  if (error) {
    if (isVariantImagesSchemaUnavailable(error)) {
      return new Map(variants.map((variant) => [variant.id, legacyVariantImage(variant)]));
    }
    catalogQueryError('as imagens das variações', error);
  }

  return ((data ?? []) as ProductVariantImage[]).reduce((grouped, image) => {
    grouped.set(image.product_variant_id, [...(grouped.get(image.product_variant_id) ?? []), image]);
    return grouped;
  }, new Map<string, ProductVariantImage[]>());
}

async function attachVariantImages(variantRows: ProductVariantRow[]) {
  const images = await getImagesForVariants(variantRows);
  return variantRows.map((variant): ProductVariant => ({
    ...variant,
    images: sortVariantImages(images.get(variant.id) ?? []),
  }));
}

async function getVariantsForProducts(productIds: string[]) {
  if (!productIds.length) return new Map<string, ProductVariant[]>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .in('product_id', productIds)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('display_order');
  if (error) catalogQueryError('as variações dos produtos', error);

  const variants = await attachVariantImages((data ?? []) as ProductVariantRow[]);
  return variants.reduce((grouped, item) => {
    grouped.set(item.product_id, [...(grouped.get(item.product_id) ?? []), item]);
    return grouped;
  }, new Map<string, ProductVariant[]>());
}

const addVariants = (items: Product[], variants: Map<string, ProductVariant[]>) => items.map((item) => ({ ...item, variants: variants.get(item.id) ?? [] }));

export async function getProducts(categorySlug?: string, subcategoryId?: string): Promise<CatalogProduct[]> {
  if (!configured) {
    return addCustomPriceText(sortProductsAlphabetically(
      (categorySlug ? products.filter((product) => product.categories?.slug === categorySlug) : products)
        .filter((product) => !subcategoryId || product.subcategory_id === subcategoryId),
    ), {});
  }

  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select('*, categories!inner(name,slug)')
    .eq('active', true)
    .eq('categories.active', true)
    .order('name');
  if (categorySlug) query = query.eq('categories.slug', categorySlug);
  if (subcategoryId) query = query.eq('subcategory_id', subcategoryId);

  const { data, error } = await query;
  if (error) catalogQueryError('os produtos', error);

  const items = (data ?? []) as Product[];
  const [labels, variants] = await Promise.all([
    getPriceLabels(),
    getVariantsForProducts(items.map((item) => item.id)),
  ]);
  return sortProductsAlphabetically(addCustomPriceText(addVariants(items, variants), labels));
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<CatalogProduct[]> {
  const categorySlug = product.categories?.slug;
  if (!categorySlug || limit < 1) return [];

  const categoryProducts = (await getProducts(categorySlug)).filter((item) => item.id !== product.id);
  if (!product.subcategory_id) return categoryProducts.slice(0, limit);

  const sameSubcategory = categoryProducts.filter((item) => item.subcategory_id === product.subcategory_id);
  const sameCategory = categoryProducts.filter((item) => item.subcategory_id !== product.subcategory_id);
  return [...sameSubcategory, ...sameCategory].slice(0, limit);
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  if (!configured) {
    const product = products.find((item) => item.slug === slug);
    return product ? addCustomPriceText([product], {})[0] : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, categories!inner(name,slug)')
    .eq('slug', slug)
    .eq('active', true)
    .eq('categories.active', true)
    .maybeSingle();
  if (error) catalogQueryError('o produto', error);
  if (!data) return null;

  const labels = await getPriceLabels();
  return addCustomPriceText([data as Product], labels)[0];
}

export async function getVariants(productId: string): Promise<ProductVariant[]> {
  if (!configured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('display_order');
  if (error) catalogQueryError('as variações do produto', error);
  return attachVariantImages((data ?? []) as ProductVariantRow[]);
}

export async function getSitemapCatalogData(): Promise<SitemapCatalogData> {
  if (!configured) {
    return {
      categories: categories.map(({ id, slug }) => ({ id, slug })),
      subcategories: [],
      products: products.map(({ slug }) => ({ slug })),
    };
  }

  const supabase = await createClient();
  const [categoriesResult, subcategoriesResult, productsResult] = await Promise.all([
    supabase.from('categories').select('id,slug').eq('active', true).order('display_order'),
    supabase.from('subcategories').select('category_id,slug').eq('active', true).order('name'),
    supabase
      .from('products')
      .select('slug,categories!inner(active)')
      .eq('active', true)
      .eq('categories.active', true)
      .order('name'),
  ]);

  const error = categoriesResult.error ?? subcategoriesResult.error ?? productsResult.error;
  if (error) catalogQueryError('os endereços do sitemap', error);

  const activeCategoryIds = new Set((categoriesResult.data ?? []).map((category) => category.id));
  return {
    categories: (categoriesResult.data ?? []) as Array<{ id: string; slug: string }>,
    subcategories: ((subcategoriesResult.data ?? []) as Array<{ category_id: string; slug: string }>)
      .filter((subcategory) => activeCategoryIds.has(subcategory.category_id)),
    products: (productsResult.data ?? []).map((product) => ({ slug: product.slug })),
  };
}
