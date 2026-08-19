import { NextResponse } from 'next/server'; import { createClient } from '@/lib/supabase/server';
export async function POST(request:Request){const s=await createClient();await s.auth.signOut();return NextResponse.redirect(new URL('/admin/login',request.url),303)}
