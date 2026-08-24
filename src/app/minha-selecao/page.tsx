import type { Metadata } from 'next';
import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';
import SelectionPageClient from '@/components/SelectionPageClient';
import { getProducts, getSettings } from '@/lib/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export const metadata: Metadata = {
  title: 'Minha Seleção',
  description: 'Revise as peças escolhidas antes de enviar sua seleção para a Tear & Aconchego.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function MinhaSelecaoPage() {
  const [settings, fallbackProducts] = await Promise.all([
    getSettings(),
    hasSupabaseEnv ? Promise.resolve([]) : getProducts(),
  ]);
  const contact = (settings.contact ?? {}) as { whatsappNumber?: string | null; whatsappUrl?: string | null };

  return <main className="min-h-screen bg-[#f7f2eb] text-[#42362d]">
    <PublicHeader active="selection" />
    <div className="mx-auto max-w-6xl">
      <SelectionPageClient whatsappNumber={contact.whatsappNumber ?? contact.whatsappUrl} supabaseConfigured={hasSupabaseEnv} fallbackProducts={fallbackProducts} />
    </div>
    <PublicFooter />
  </main>;
}
