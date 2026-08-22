import Link from 'next/link';
import { getBenefits, getCategories, getSettings } from '@/lib/catalog';

export default async function Home() {
  const [s, c, b] = await Promise.all([getSettings(), getCategories(), getBenefits()]);
  const hero = s.hero as { title: string; description: string; buttonText: string; imageUrl: string };
  const brand = s.brand as { name: string; tagline: string; footer: string };
  const contact = s.contact as { whatsappUrl: string; phone: string };

  return <main className="min-h-screen bg-[#eee7dd] text-[#39362f]">
    <div className="mx-auto min-h-screen max-w-[1320px] bg-[#f5f0e8]">
      <header className="flex items-center justify-between bg-[#52604a] px-5 py-4 text-white md:px-10 md:py-5 lg:px-14">
        <span className="font-serif text-xl md:text-2xl">{brand.name}</span>
        <a className="text-sm md:text-base" href={contact.whatsappUrl}>WhatsApp ↗</a>
      </header>

      <section className="bg-[#f1e9df]">
        <div className="mx-auto flex max-w-4xl flex-col items-start px-8 py-8 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <p className="mb-4 hidden text-[10px] tracking-[.2em] md:block md:text-xs">{brand.tagline}</p>
          <h1 className="max-w-3xl font-serif text-5xl leading-none md:text-6xl lg:text-7xl">{hero.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed md:text-lg">{hero.description}</p>
          <Link className="mt-7 w-fit rounded bg-[#52604a] px-5 py-3 text-xs font-bold text-white md:mt-9 md:px-6 md:py-4" href="/catalogo">{hero.buttonText}</Link>
        </div>
        <div className="mx-auto max-w-[1120px] px-0 pb-0 md:px-10 lg:px-14">
          <div className="min-h-64 bg-cover bg-center md:min-h-[460px] lg:min-h-[560px]" style={{ backgroundImage: `url(${hero.imageUrl})` }} />
        </div>
      </section>

      <section className="px-7 py-14 md:px-16 lg:px-20 lg:py-18"><h2 className="mb-8 text-center font-serif text-2xl uppercase tracking-wider">Nossas peças</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{c.map(x => <Link key={x.id} href={`/catalogo/${x.slug}`} className="overflow-hidden rounded border border-[#d9cebf] bg-[#f8f4ed]"><img className="h-56 w-full object-cover transition hover:scale-105" src={x.image_url ?? ''} alt="" /><div className="p-4"><h3 className="text-sm font-bold uppercase">{x.name}</h3><p className="mt-2 text-sm">{x.description}</p><span className="mt-4 inline-block rounded bg-[#87623d] px-3 py-2 text-[10px] font-bold text-white">VER PEÇAS</span></div></Link>)}</div></section>
      <section className="grid gap-5 bg-[#e7dbca] px-7 py-10 sm:grid-cols-2 lg:grid-cols-4 md:px-16">{b.map(x => <div key={x.id} className="grid grid-cols-[38px_1fr] gap-2"><span className="text-2xl">{x.icon}</span><div><strong className="text-xs uppercase">{x.title}</strong><p className="text-xs">{x.description}</p></div></div>)}</section>
      <footer className="flex flex-col gap-2 bg-[#e1d0b6] px-7 py-5 text-sm md:flex-row md:justify-between md:px-16"><span>{brand.footer}</span><a href={contact.whatsappUrl}>◔ {contact.phone}</a></footer>
    </div>
  </main>;
}
