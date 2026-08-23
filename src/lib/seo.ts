import type { Metadata } from 'next';

export const SITE_NAME = 'Tear & Aconchego';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tear-e-aconchego.vercel.app').replace(/\/$/, '');
export const DEFAULT_DESCRIPTION = 'Peças artesanais para mesa posta e decoração, criadas para transformar ambientes com textura, elegância e aconchego.';

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function metadataDescription(value?: string | null, fallback = DEFAULT_DESCRIPTION) {
  const text = value?.trim() || fallback;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}...` : text;
}

export function validImageUrl(value?: string | null) {
  try {
    if (!value) return undefined;
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function serializeJsonLd(value: unknown) {
  const serialized = JSON.stringify(value) ?? 'null';
  return serialized
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function publicMetadata({ title, description, path, image, type = 'website', absoluteTitle = false }: { title: string; description: string; path: string; image?: string | null; type?: 'website' | 'article'; absoluteTitle?: boolean }): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const shareImage = validImageUrl(image);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: absoluteUrl(path), siteName: SITE_NAME, locale: 'pt_BR', type, ...(shareImage ? { images: [{ url: shareImage }] } : {}) },
    twitter: { card: shareImage ? 'summary_large_image' : 'summary', title: fullTitle, description, ...(shareImage ? { images: [shareImage] } : {}) },
  };
}
