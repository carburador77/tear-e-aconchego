'use client';
/* eslint-disable @next/next/no-img-element -- A imagem da capa vem de uma URL configurável. */

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getInstagramUrl } from '@/lib/social';
import { createClient } from '@/lib/supabase/client';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import { DEFAULT_WHATSAPP_NUMBER, normalizeWhatsAppNumber } from '@/lib/whatsapp';

type Values = Record<string, string>;
type LoadState = 'loading' | 'ready' | 'error';
type SettingRow = { key: string; value: unknown; updated_at: string };
type SettingMutation = { key: string; value: Record<string, string> };
type LoadedSettings = { values: Values; revisions: Record<string, string | undefined> };

const defaults: Values = {
  forest: '#52604a',
  cream: '#f5f0e8',
  sand: '#e7dbca',
  clay: '#997245',
  text: '#39362f',
  textMuted: '#766d63',
  textOnDark: '#f6f0e7',
  brandText: '#f6f0e7',
  buttonText: '#ffffff',
  whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
}

function stringRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function parseSettings(rows: SettingRow[]): LoadedSettings {
  const settings = new Map(rows.map((row) => [row.key, stringRecord(row.value)]));
  const brand = settings.get('brand') ?? {};
  const hero = settings.get('hero') ?? {};
  const contact = settings.get('contact') ?? {};
  const social = settings.get('social') ?? {};
  const theme = settings.get('theme') ?? {};
  return {
    values: {
      ...defaults,
      brandName: brand.name ?? '',
      tagline: brand.tagline ?? '',
      footer: brand.footer ?? '',
      heroTitle: hero.title ?? '',
      heroDescription: hero.description ?? '',
      heroButton: hero.buttonText ?? '',
      heroImage: hero.imageUrl ?? '',
      phone: contact.phone ?? '',
      whatsappNumber: normalizeWhatsAppNumber(contact.whatsappNumber ?? contact.whatsappUrl),
      instagramUrl: social.instagramUrl ?? '',
      ...theme,
    },
    revisions: Object.fromEntries(rows.map((row) => [row.key, row.updated_at])),
  };
}

async function cleanupImage(url: string) {
  try {
    await removeImage(url);
    return null;
  } catch (error) {
    return errorMessage(error, 'Não foi possível limpar a imagem.');
  }
}

export default function Settings() {
  const [supabase] = useState(() => createClient());
  const [values, setValues] = useState<Values>(defaults);
  const [revisions, setRevisions] = useState<Record<string, string | undefined>>({});
  const [storedHeroImage, setStoredHeroImage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase.from('site_settings').select('key,value,updated_at');
    if (error) throw error;
    return parseSettings((data ?? []) as SettingRow[]);
  }, [supabase]);

  useEffect(() => {
    let ignore = false;
    void fetchSettings()
      .then((loaded) => {
        if (ignore) return;
        setValues(loaded.values);
        setRevisions(loaded.revisions);
        setStoredHeroImage(loaded.values.heroImage ?? '');
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setLoadError(errorMessage(error, 'Não foi possível carregar as configurações.'));
        setLoadState('error');
      });
    return () => { ignore = true; };
  }, [fetchSettings]);

  const retryLoad = () => {
    setLoadState('loading');
    setLoadError('');
    setMessage('');
    void fetchSettings()
      .then((loaded) => {
        setValues(loaded.values);
        setRevisions(loaded.revisions);
        setStoredHeroImage(loaded.values.heroImage ?? '');
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        setLoadError(errorMessage(error, 'Não foi possível carregar as configurações.'));
        setLoadState('error');
      });
  };

  const field = (key: string, label: string, type = 'text') => <label className="block text-sm font-semibold">{label}<input className="mt-1 w-full" type={type} value={values[key] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>;

  const persistSettings = async (rows: SettingMutation[]) => {
    const nextRevisions = { ...revisions };
    const revisionBase = Date.now();
    for (const [index, row] of rows.entries()) {
      const nextRevision = new Date(revisionBase + index).toISOString();
      const currentRevision = revisions[row.key];
      if (currentRevision) {
        const { data, error } = await supabase
          .from('site_settings')
          .update({ value: row.value, updated_at: nextRevision })
          .eq('key', row.key)
          .eq('updated_at', currentRevision)
          .select('updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('As configurações foram alteradas em outra aba ou sessão. Recarregue antes de salvar novamente.');
        nextRevisions[row.key] = data.updated_at;
      } else {
        const { data, error } = await supabase
          .from('site_settings')
          .insert({ key: row.key, value: row.value, updated_at: nextRevision })
          .select('updated_at')
          .single();
        if (error) {
          if (errorCode(error) === '23505') throw new Error('As configurações foram alteradas em outra aba ou sessão. Recarregue antes de salvar novamente.');
          throw error;
        }
        nextRevisions[row.key] = data.updated_at;
      }
    }
    return nextRevisions;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || loadState !== 'ready') return;
    setSaving(true);
    setMessage('');

    const previousHeroImage = storedHeroImage || null;
    let uploadedImageUrl: string | null = null;
    let persistenceStarted = false;

    try {
      const whatsappNumber = normalizeWhatsAppNumber(values.whatsappNumber);
      const instagramUrl = getInstagramUrl(values.instagramUrl);
      if (values.instagramUrl.trim() && !instagramUrl) throw new Error('Informe uma URL válida do Instagram, como https://www.instagram.com/seu-perfil');

      if (file) uploadedImageUrl = await uploadImage(file, 'site');
      const heroImage = uploadedImageUrl ?? values.heroImage;

      // A capa é persistida por último: se uma revisão anterior conflitar, a nova imagem ainda não foi referenciada.
      const rows: SettingMutation[] = [
        { key: 'brand', value: { name: values.brandName, tagline: values.tagline, footer: values.footer } },
        { key: 'contact', value: { phone: values.phone, whatsappNumber, whatsappUrl: `https://wa.me/${whatsappNumber}` } },
        { key: 'social', value: { instagramUrl: instagramUrl ?? '' } },
        { key: 'theme', value: { forest: values.forest, cream: values.cream, sand: values.sand, clay: values.clay, text: values.text, textMuted: values.textMuted, textOnDark: values.textOnDark, brandText: values.brandText, buttonText: values.buttonText } },
        { key: 'hero', value: { title: values.heroTitle, description: values.heroDescription, buttonText: values.heroButton, imageUrl: heroImage } },
      ];

      persistenceStarted = true;
      const nextRevisions = await persistSettings(rows);
      setRevisions(nextRevisions);
      setStoredHeroImage(heroImage);
      setValues((current) => ({ ...current, heroImage, whatsappNumber, instagramUrl: instagramUrl ?? '' }));
      setFile(null);

      const cleanupError = uploadedImageUrl && previousHeroImage && uploadedImageUrl !== previousHeroImage
        ? await cleanupImage(previousHeroImage)
        : null;
      setMessage(cleanupError
        ? `Configurações salvas, mas não foi possível remover a imagem anterior: ${cleanupError}`
        : 'Configurações salvas.');
    } catch (error) {
      const cleanupError = uploadedImageUrl ? await cleanupImage(uploadedImageUrl) : null;
      const suffix = cleanupError ? ` A nova imagem também não pôde ser removida: ${cleanupError}` : '';
      const failure = `${errorMessage(error, 'Erro ao salvar as configurações.')}${suffix}`;
      if (persistenceStarted) {
        setLoadError(failure);
        setLoadState('error');
      } else {
        setMessage(failure);
      }
    } finally {
      setSaving(false);
    }
  };

  return <main className="mx-auto max-w-4xl p-6">
    <Link href="/admin" className="text-sm underline">← Voltar ao painel</Link>
    <h1 className="mt-4 font-serif text-3xl">Configurações do catálogo</h1>
    {loadState === 'loading' && <p role="status" className="mt-6">Carregando configurações...</p>}
    {loadState === 'error' && <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-5" role="alert">
      <p>{loadError}</p>
      <button type="button" onClick={retryLoad} className="mt-4 rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">TENTAR NOVAMENTE</button>
    </div>}
    {loadState === 'ready' && <form onSubmit={save} className="mt-6 space-y-5">
      <section className="rounded-lg bg-[#f2ece3] p-5">
        <h2 className="font-serif text-2xl">Marca e capa</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field('brandName', 'Nome da marca')}
          {field('tagline', 'Slogan')}
          {field('footer', 'Texto do rodapé')}
          {field('heroTitle', 'Título da capa')}
          {field('heroDescription', 'Descrição')}
          {field('heroButton', 'Texto do botão')}
          {field('heroImage', 'URL da imagem atual')}
          <label className="block text-sm font-semibold">Enviar nova imagem da capa<input className="mt-1 w-full" type="file" accept={CATALOG_IMAGE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          {values.heroImage && <img className="h-32 w-48 object-cover" src={values.heroImage} alt="Prévia" />}
          {field('phone', 'Telefone')}
          {field('whatsappNumber', 'Número do WhatsApp da loja')}
          {field('instagramUrl', 'URL do Instagram')}
        </div>
      </section>
      <section className="rounded-lg bg-[#f2ece3] p-5">
        <h2 className="font-serif text-2xl">Cores</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field('forest', 'Verde principal', 'color')}
          {field('cream', 'Fundo creme', 'color')}
          {field('sand', 'Faixa de diferenciais', 'color')}
          {field('clay', 'Fundo dos botões', 'color')}
          {field('buttonText', 'Texto dos botões', 'color')}
          {field('brandText', 'Texto do nome da marca', 'color')}
          {field('text', 'Texto principal', 'color')}
          {field('textMuted', 'Texto secundário', 'color')}
          {field('textOnDark', 'Texto em fundo escuro', 'color')}
        </div>
      </section>
      <button disabled={saving} className="rounded bg-[#52604a] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}</button>
      {message && <p role="status">{message}</p>}
    </form>}
  </main>;
}
