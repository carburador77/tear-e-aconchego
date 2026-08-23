import Link from 'next/link';

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f0e8] px-6 py-16 text-center text-[#39362f]">
    <section className="w-full max-w-xl rounded-lg border border-[#d9cebf] bg-[#fffdf9] px-7 py-12 shadow-sm" aria-labelledby="not-found-title">
      <p className="text-xs uppercase tracking-[.2em] text-[#766d63]">Erro 404</p>
      <h1 id="not-found-title" className="mt-4 font-serif text-3xl">Página não encontrada</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#5f5549]">Esta página, categoria ou peça não está disponível.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/catalogo" className="rounded bg-[#52604a] px-5 py-3 text-sm font-bold text-white">VER O CATÁLOGO</Link>
        <Link href="/" className="rounded border border-[#52604a] px-5 py-3 text-sm font-bold text-[#52604a]">VOLTAR AO INÍCIO</Link>
      </div>
    </section>
  </main>;
}
