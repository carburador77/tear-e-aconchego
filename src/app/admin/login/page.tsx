'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const redirectErrors: Record<string, string> = {
  sessao: 'Sua sessão expirou. Entre novamente para continuar.',
  'sem-permissao': 'Este usuário não tem permissão para acessar o painel.',
  perfil: 'Não foi possível validar seu acesso agora. Tente novamente.',
  configuracao: 'O acesso administrativo está temporariamente indisponível.',
  logout: 'Não foi possível encerrar a sessão completamente. Tente novamente.',
};

const subscribeToUrl = () => () => undefined;

function getRedirectError() {
  const reason = new URLSearchParams(window.location.search).get('erro');
  return reason ? redirectErrors[reason] ?? '' : '';
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const redirectedError = useSyncExternalStore(subscribeToUrl, getRedirectError, () => '');
  const [errorOverride, setErrorOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const error = errorOverride ?? redirectedError;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrorOverride('');

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError || !data.user) {
        setErrorOverride(
          signInError?.code === 'invalid_credentials'
            ? 'E-mail ou senha incorretos.'
            : 'Não foi possível entrar agora. Tente novamente.',
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        setErrorOverride('Não foi possível validar seu acesso agora. Tente novamente.');
        return;
      }

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        setErrorOverride('Este usuário não tem permissão para acessar o painel.');
        return;
      }

      await supabase.auth.getSession();
      router.replace('/admin');
      router.refresh();
    } catch {
      setErrorOverride('Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f2ece3] p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-[#fffdf9] p-7 shadow">
        <h1 className="font-serif text-3xl text-[#52604a]">Área administrativa</h1>
        <p className="mb-6 mt-2 text-sm">Entre para administrar o catálogo.</p>
        <label className="block text-sm">
          E-mail
          <input
            className="mt-1 w-full rounded border p-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm">
          Senha
          <input
            className="mt-1 w-full rounded border p-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          className="mt-6 w-full rounded bg-[#52604a] p-3 text-sm font-bold text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'ENTRANDO…' : 'ENTRAR'}
        </button>
      </form>
    </main>
  );
}
