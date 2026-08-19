import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSettings } from '@/lib/catalog';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = { title: "Tear & Aconchego", description: "Arte em cada detalhe" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings=await getSettings(); const theme=(settings.theme ?? {}) as {forest?:string;cream?:string;sand?:string;clay?:string;text?:string;textMuted?:string;textOnDark?:string;brandText?:string;buttonText?:string};
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><style>{`:root{--catalog-forest:${theme.forest??'#52604a'};--catalog-cream:${theme.cream??'#f5f0e8'};--catalog-sand:${theme.sand??'#e7dbca'};--catalog-clay:${theme.clay??'#997245'};--catalog-text:${theme.text??'#39362f'};--catalog-muted:${theme.textMuted??'#766d63'};--catalog-on-dark:${theme.textOnDark??'#f6f0e7'};--catalog-brand-text:${theme.brandText??'#f6f0e7'};--catalog-button-text:${theme.buttonText??'#ffffff'}}`}</style>{children}</body>
    </html>
  );
}
