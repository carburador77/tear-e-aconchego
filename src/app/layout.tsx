import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSettings } from '@/lib/catalog';
import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/seo';
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
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings=await getSettings(); const theme=(settings.theme ?? {}) as {forest?:string;cream?:string;sand?:string;clay?:string;text?:string;textMuted?:string;textOnDark?:string;brandText?:string;buttonText?:string}; const social=(settings.social ?? {}) as {instagramUrl?:string}; const instagramUrl=getInstagramUrl(social.instagramUrl);
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/'), ...(instagramUrl ? { sameAs: [instagramUrl] } : {}) }) }} /><style>{`:root{--catalog-forest:${theme.forest??'#52604a'};--catalog-cream:${theme.cream??'#f5f0e8'};--catalog-sand:${theme.sand??'#e7dbca'};--catalog-clay:${theme.clay??'#997245'};--catalog-text:${theme.text??'#39362f'};--catalog-muted:${theme.textMuted??'#766d63'};--catalog-on-dark:${theme.textOnDark??'#f6f0e7'};--catalog-brand-text:${theme.brandText??'#f6f0e7'};--catalog-button-text:${theme.buttonText??'#ffffff'}}`}</style><SelectionProvider>{children}</SelectionProvider></body>
    </html>
  );
}
