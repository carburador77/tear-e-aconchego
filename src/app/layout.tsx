import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getDefaultSettings, getSettings } from '@/lib/catalog';
import { absoluteUrl, DEFAULT_DESCRIPTION, serializeJsonLd, SITE_NAME } from '@/lib/seo';
import { getInstagramUrl } from '@/lib/social';
import SelectionProvider from '@/components/SelectionProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: 'pt_BR', type: 'website' },
  twitter: { card: 'summary' },
  robots: { index: true, follow: true },
  icons: { icon: [{ url: '/branding/logo-favicon.png', type: 'image/png' }] },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Falhas do layout raiz não são capturadas pelo error.tsx deste segmento.
  // As páginas continuam propagando o erro, mas o invólucro usa um tema seguro.
  const settings = await getSettings().catch(() => getDefaultSettings());
  const { theme, social } = settings;
  const instagramUrl = getInstagramUrl(social.instagramUrl);
  const organizationJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    ...(instagramUrl ? { sameAs: [instagramUrl] } : {}),
  });

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
        <style>{`:root{--catalog-forest:${theme.forest};--catalog-cream:${theme.cream};--catalog-sand:${theme.sand};--catalog-clay:${theme.clay};--catalog-text:${theme.text};--catalog-muted:${theme.textMuted};--catalog-on-dark:${theme.textOnDark};--catalog-brand-text:${theme.brandText};--catalog-button-text:${theme.buttonText};--catalog-header-background:${theme.headerBackground};--catalog-header-nav-text:${theme.headerNavText};--catalog-header-nav-active:${theme.headerNavActive};--catalog-header-nav-hover:${theme.headerNavHover};--catalog-header-whatsapp-text:${theme.headerWhatsappText}}`}</style>
        <SelectionProvider>{children}</SelectionProvider>
      </body>
    </html>
  );
}
