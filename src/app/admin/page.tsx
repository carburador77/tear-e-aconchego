import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Admin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login?erro=sessao');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f2ece3] p-5 text-[#37342e]">
        <section role="alert" className="w-full max-w-md rounded-xl bg-[#fffdf9] p-7 shadow">
          <h1 className="font-serif text-2xl text-[#52604a]">Não foi possível validar o acesso</h1>
          <p className="mt-3 text-sm">
            O painel não conseguiu consultar seu perfil agora. Tente novamente em instantes.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href="/admin" className="font-semibold underline">Tentar novamente</Link>
            <form action="/auth/signout" method="post">
              <button className="underline">Sair</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  if (profile?.role !== 'admin') redirect('/admin/login?erro=sem-permissao');

  return (
    <main className="min-h-screen bg-[#f2ece3] p-6 text-[#37342e]">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <h1 className="font-serif text-3xl text-[#52604a]">Teia &amp; Aconchego</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline">Sair</button>
        </form>
      </header>
      <section className="mx-auto mt-8 max-w-5xl">
        <h2 className="font-serif text-3xl">Painel administrativo</h2>
        <p className="mt-2">Gerencie o catálogo publicado.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card href="/admin/categorias" title="Categorias" text="Criar, editar, ordenar e desativar." />
          <Card href="/admin/produtos" title="Produtos" text="Peças, preços, detalhes e imagens." />
          <Card href="/admin/configuracoes" title="Configurações" text="Marca, hero, WhatsApp e diferenciais." />
        </div>
      </section>
    </main>
  );
}

function Card({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg bg-white p-5 shadow transition hover:-translate-y-0.5">
      <h3 className="font-serif text-xl text-[#52604a]">{title}</h3>
      <p className="mt-2 text-sm">{text}</p>
    </Link>
  );
}
