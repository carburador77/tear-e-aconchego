import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function expireAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      response.cookies.set({ name, value: '', expires: new Date(0), path: '/' });
    }
  });
}

function failedLogoutResponse(request: NextRequest, url: URL) {
  url.searchParams.set('erro', 'logout');
  const response = NextResponse.redirect(url, 303);
  expireAuthCookies(request, response);
  return response;
}

export async function POST(request: NextRequest) {
  const url = new URL('/admin/login', request.url);
  const response = NextResponse.redirect(url, 303);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return failedLogoutResponse(request, url);
    }
  } catch {
    return failedLogoutResponse(request, url);
  }

  expireAuthCookies(request, response);
  return response;
}
