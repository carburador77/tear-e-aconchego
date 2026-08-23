import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductColorSelector from '@/components/ProductColorSelector';
import PublicHeader from '@/components/PublicHeader';
import { getProduct, getSettings, getVariants } from '@/lib/catalog';
import { formatProductPrice } from '@/lib/price';
import { buildProductWhatsAppUrl, DEFAULT_WHATSAPP_NUMBER } from '@/lib/whatsapp';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProduct(slug), getSettings()]);
  if (!product) notFound();

  const variants = await getVariants(product.id);
  const contact = settings.contact as { whatsappNumber?: string };
  const whatsappUrl = buildProductWhatsAppUrl({ number: contact.whatsappNumber ?? DEFAULT_WHATSAPP_NUMBER, productName: product.name, customMessage: product.whatsapp_url });

  return <main className="mx-auto min-h-screen max-w-6xl bg-[#f7f2eb]">
    <PublicHeader active="catalog" />
    <div className="px-6 py-6">
      <Link href="/catalogo">← Voltar ao catálogo</Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2"><ProductColorSelector image={product.image_url ?? ''} variants={variants} /><section><p className="text-[10px] uppercase">{product.categories?.name}</p><h1 className="mt-3 font-serif text-4xl">{product.name}</h1><p className="mt-2 font-serif text-2xl">{formatProductPrice(product.price, product.price_label)}</p><p className="my-8">{product.description}</p>{[['A origem', product.origin], ['Dimensões', product.dimensions], ['Cuidados', product.care]].map(([title, value]) => <div className="border-t border-[#d7cabc] py-5" key={title}><h2 className="font-serif text-lg">{title}</h2><p>{value}</p></div>)}<p className="mt-1 text-sm leading-relaxed">✦ Consulte disponibilidade de cores e possibilidades de personalização.</p><a className="mt-6 block bg-[#8a785d] p-4 text-center text-xs font-bold text-white" href={whatsappUrl} target="_blank" rel="noreferrer">ENCOMENDAR PELO WHATSAPP</a></section></div>
    </div>
  </main>;
}
