import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCatalogCard from '@/components/ProductCatalogCard';
import ProductColorSelector from '@/components/ProductColorSelector';
import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';
import { getProduct, getRelatedProducts, getSettings, getSubcategories, getVariants } from '@/lib/catalog';
import { formatProductPrice } from '@/lib/price';
import { primaryVariantImage, variantImageUrls } from '@/lib/product-images';
import { buildProductWhatsAppUrl, DEFAULT_WHATSAPP_NUMBER } from '@/lib/whatsapp';
import { metadataDescription, publicMetadata, serializeJsonLd, SITE_NAME, validImageUrl } from '@/lib/seo';

type ProductRouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return publicMetadata({ title: 'Produto', description: 'Conheça as peças artesanais da Tear & Aconchego.', path: '/catalogo' });
  const variants = await getVariants(product.id);
  const shareImage = primaryVariantImage(variants[0])?.image_url ?? product.image_url;
  return publicMetadata({ title: product.name, description: metadataDescription(product.description, `Conheça o ${product.name} da Tear & Aconchego.`), path: `/produto/${product.slug}`, image: shareImage, type: 'article' });
}

export default async function Page({ params }: ProductRouteProps) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProduct(slug), getSettings()]);
  if (!product) notFound();

  const [variants, relatedProducts, subcategories] = await Promise.all([
    getVariants(product.id),
    getRelatedProducts(product),
    product.categories?.slug && product.subcategory_id ? getSubcategories(product.category_id) : Promise.resolve([]),
  ]);
  const subcategory = subcategories.find((item) => item.id === product.subcategory_id);
  const category = product.categories ?? null;
  const subcategoryHref = category && subcategory ? `/catalogo/${category.slug}?subcategoria=${encodeURIComponent(subcategory.slug)}` : null;
  const whatsappUrl = buildProductWhatsAppUrl({ number: settings.contact.whatsappNumber ?? DEFAULT_WHATSAPP_NUMBER, productName: product.name, customMessage: product.whatsapp_url });
  const details = [['Material', product.origin], ['Dimensões', product.dimensions], ['Cuidados', product.care]].filter(([, value]) => typeof value === 'string' && value.trim());
  const defaultVariantImages = variantImageUrls(variants[0]).map(validImageUrl).filter((url): url is string => Boolean(url));
  const productFallbackImage = validImageUrl(product.image_url);
  const structuredImages = defaultVariantImages.length ? defaultVariantImages : productFallbackImage ? [productFallbackImage] : [];
  const structuredData = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: metadataDescription(product.description, `Conheça o ${product.name} da Tear & Aconchego.`), ...(structuredImages.length ? { image: structuredImages } : {}), brand: { '@type': 'Brand', name: SITE_NAME } };

  return <main className="min-h-screen bg-[#f7f2eb]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
    <PublicHeader active="catalog" />
    <div className="mx-auto max-w-6xl px-6 py-6">
      <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6e6254]"><li><Link href="/catalogo" className="rounded underline-offset-4 transition hover:text-[#42362d] hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">Catálogo</Link></li>{category && <><li aria-hidden="true">›</li><li><Link href={`/catalogo/${category.slug}`} className="rounded underline-offset-4 transition hover:text-[#42362d] hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">{category.name}</Link></li></>}{subcategory && subcategoryHref && <><li aria-hidden="true">›</li><li><Link href={subcategoryHref} className="rounded underline-offset-4 transition hover:text-[#42362d] hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">{subcategory.name}</Link></li></>}</ol></nav>
      <Link href="/catalogo" className="mt-3 inline-flex rounded text-sm underline underline-offset-4 transition hover:text-[#52604a] focus:outline-none focus:ring-2 focus:ring-[#52604a]">← Voltar ao catálogo</Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2"><ProductColorSelector image={product.image_url ?? ''} variants={variants} productId={product.id} productName={product.name} /><section><h1 className="font-serif text-4xl leading-tight">{product.name}</h1><p className="mt-2 font-serif text-2xl">{formatProductPrice(product.price, product.custom_price_text)}</p>{product.description && <p className="my-8 max-w-prose leading-relaxed">{product.description}</p>}{details.map(([title, value]) => <div className="border-t border-[#d7cabc] py-5" key={title}><h2 className="font-serif text-lg">{title}</h2><p>{value}</p></div>)}<p className="mt-1 text-sm leading-relaxed">✦ Consulte disponibilidade de cores e possibilidades de personalização.</p><a className="mt-6 block bg-[#8a785d] p-4 text-center text-xs font-bold text-white" href={whatsappUrl} target="_blank" rel="noreferrer">ENCOMENDAR PELO WHATSAPP</a></section></div>
      {relatedProducts.length > 0 && <section className="mt-16 border-t border-[#d7cabc] pt-10" aria-labelledby="related-products-title"><h2 id="related-products-title" className="font-serif text-2xl">Você também pode gostar</h2><div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{relatedProducts.map((relatedProduct) => <ProductCatalogCard key={relatedProduct.id} product={relatedProduct} />)}</div></section>}
    </div>
    <PublicFooter />
  </main>;
}
