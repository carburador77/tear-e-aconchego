import type { Metadata } from 'next';
import Link from 'next/link';
import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';
import { getBenefits, getCategories, getSettings } from '@/lib/catalog';
import { metadataDescription, publicMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const { hero } = settings;
  return publicMetadata({ title: 'Tear & Aconchego | Decoração Artesanal', description: metadataDescription(hero.description), path: '/', image: hero.imageUrl, absoluteTitle: true });
}

export default async function Home() {
  const [s, c, b] = await Promise.all([getSettings(), getCategories(), getBenefits()]);
  const { hero, brand, contact } = s;

  return <main className="min-h-screen bg-[#f5f0e8] text-[#39362f]">
    <PublicHeader active="home" />

    <section className="bg-[#f1e9df]">
      <div className="mx-auto grid max-w-6xl gap-9 px-6 py-10 md:px-8 md:py-12 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] lg:items-center lg:gap-12 lg:py-14 xl:gap-16 xl:py-16">
        <div className="flex flex-col items-start lg:py-4">
          <p className="mb-4 hidden text-[10px] tracking-[.2em] md:block md:text-xs">{brand.tagline}</p>
          <h1 className="max-w-3xl font-serif text-5xl leading-[.98] md:text-6xl lg:max-w-[32rem] lg:text-[clamp(3.25rem,4.5vw,5.2rem)]">{hero.title}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed md:text-lg">{hero.description}</p>
          <Link className="mt-7 w-fit rounded bg-[#52604a] px-5 py-3 text-xs font-bold text-white md:mt-8 md:px-6 md:py-4" href="/catalogo">{hero.buttonText}</Link>
        </div>
        <div className="min-h-64 bg-cover bg-center md:min-h-[400px] lg:h-[clamp(27rem,38vw,33rem)] lg:min-h-0" style={{ backgroundImage: `url(${hero.imageUrl})` }} />
      </div>
    </section>

    <section className="px-7 py-14 md:px-16 lg:px-20 lg:py-18"><div className="mx-auto max-w-6xl"><h2 className="mb-8 text-center font-serif text-2xl uppercase tracking-wider">Nossas peças</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{c.map(x => <Link key={x.id} href={`/catalogo/${x.slug}`} className="overflow-hidden rounded border border-[#d9cebf] bg-[#f8f4ed]"><img className="h-56 w-full object-cover transition hover:scale-105" src={x.image_url ?? ''} alt={`Categoria ${x.name}`} width="900" height="504" loading="lazy" decoding="async" /><div className="p-4"><h3 className="text-sm font-bold uppercase">{x.name}</h3><p className="mt-2 text-sm">{x.description}</p><span className="mt-4 inline-block rounded bg-[#87623d] px-3 py-2 text-[10px] font-bold text-white">VER PEÇAS</span></div></Link>)}</div></div></section>
      <section className="border-t border-[#d9cebf] px-7 py-14 md:px-16 lg:px-20"><div className="mx-auto max-w-5xl"><h2 className="text-center font-serif text-2xl uppercase tracking-wider">Como encomendar</h2><div className="mt-9 grid gap-8 md:grid-cols-3 md:gap-12"><div><span className="font-serif text-lg text-[#87623d]">01</span><h3 className="mt-3 font-serif text-xl">Escolha sua peça</h3><p className="mt-2 text-sm leading-relaxed">Explore o catálogo e encontre a peça que combina com seu ambiente.</p></div><div><span className="font-serif text-lg text-[#87623d]">02</span><h3 className="mt-3 font-serif text-xl">Consulte as opções</h3><p className="mt-2 text-sm leading-relaxed">Confira as cores disponíveis e fale conosco sobre possibilidades de personalização.</p></div><div><span className="font-serif text-lg text-[#87623d]">03</span><h3 className="mt-3 font-serif text-xl">Faça sua encomenda</h3><p className="mt-2 text-sm leading-relaxed">Entre em contato pelo WhatsApp para confirmar os detalhes e realizar sua encomenda.</p><a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-bold underline underline-offset-4">FALAR PELO WHATSAPP ↗</a></div></div></div></section>
    <section className="bg-[#e7dbca] px-7 py-10 md:px-16"><div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">{b.map(x => <div key={x.id} className="grid grid-cols-[38px_1fr] gap-2"><span className="text-2xl">{x.icon}</span><div><strong className="text-xs uppercase">{x.title}</strong><p className="text-xs">{x.description}</p></div></div>)}</div></section>
    <PublicFooter />
  </main>;
}
