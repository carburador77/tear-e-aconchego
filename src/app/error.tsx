'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <main className="grid min-h-screen place-items-center bg-[#f5f0e8] px-6 py-16 text-center text-[#39362f]">
    <section className="w-full max-w-xl rounded-lg border border-[#d9cebf] bg-[#fffdf9] px-7 py-12 shadow-sm" aria-labelledby="error-title">
      <p className="text-xs uppercase tracking-[.2em] text-[#766d63]">Tear &amp; Aconchego</p>
      <h1 id="error-title" className="mt-4 font-serif text-3xl">Não foi possível carregar esta página</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#5f5549]">O catálogo pode estar temporariamente indisponível. Tente novamente em alguns instantes.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => reset()} className="rounded bg-[#52604a] px-5 py-3 text-sm font-bold text-white">TENTAR NOVAMENTE</button>
        <Link href="/" className="rounded border border-[#52604a] px-5 py-3 text-sm font-bold text-[#52604a]">VOLTAR AO INÍCIO</Link>
      </div>
    </section>
  </main>;
}
