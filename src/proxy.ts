import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const LOGIN_PATH = '/admin/login';

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  error?: 'sessao' | 'sem-permissao' | 'perfil' | 'configuracao',
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  if (error) url.searchParams.set('erro', error);

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === LOGIN_PATH;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return isLoginPage
      ? response
      : redirectWithCookies(request, response, LOGIN_PATH, 'configuracao');
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return isLoginPage
      ? response
      : redirectWithCookies(request, response, LOGIN_PATH, 'sessao');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    // A raiz do painel também faz a verificação segura e exibe um erro recuperável.
    if (pathname === '/admin' || isLoginPage) return response;
    return redirectWithCookies(request, response, LOGIN_PATH, 'perfil');
  }

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return isLoginPage
      ? response
      : redirectWithCookies(request, response, LOGIN_PATH, 'sem-permissao');
  }

  if (isLoginPage) {
    return redirectWithCookies(request, response, '/admin');
  }

  return response;
}

export const config = { matcher: ['/admin/:path*'] };
