'use client';
/* eslint-disable @next/next/no-img-element -- A imagem da capa vem de uma URL configurável. */

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import ColorSettingField, { hexToRgb, normalizeHex } from '@/components/admin/ColorSettingField';
import { getInstagramUrl } from '@/lib/social';
import { createClient } from '@/lib/supabase/client';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import { DEFAULT_WHATSAPP_NUMBER, normalizeWhatsAppNumber } from '@/lib/whatsapp';

type Values = Record<string, string>;
type LoadState = 'loading' | 'ready' | 'error';
type SettingRow = { key: string; value: unknown; updated_at: string };
type SettingMutation = { key: string; value: Record<string, string> };
type LoadedSettings = { values: Values; revisions: Record<string, string | undefined> };
type ColorKey = 'forest' | 'cream' | 'sand' | 'clay' | 'text' | 'textMuted' | 'textOnDark' | 'brandText' | 'buttonText' | 'headerBackground' | 'headerNavText' | 'headerNavActive' | 'headerNavHover' | 'headerWhatsappText';

const colorKeys: ColorKey[] = ['forest', 'headerBackground', 'brandText', 'headerNavText', 'headerNavActive', 'headerNavHover', 'headerWhatsappText', 'cream', 'sand', 'clay', 'buttonText', 'text', 'textMuted', 'textOnDark'];
const colorGroups: Array<{ title: string; fields: Array<{ key: ColorKey; label: string; description: string }> }> = [
  {
    title: 'Identidade da marca',
    fields: [
      { key: 'forest', label: 'Cor principal da marca', description: 'Usada em botões de destaque e nos elementos que utilizam o tom principal da identidade visual.' },
    ],
  },
  {
    title: 'Cabeçalho e navegação',
    fields: [
      { key: 'headerBackground', label: 'Fundo do cabeçalho', description: 'Cor de fundo da barra superior de navegação do site.' },
      { key: 'brandText', label: 'Nome da marca no cabeçalho', description: 'Cor do texto “Tear & Aconchego” exibido no topo do site.' },
      { key: 'headerNavText', label: 'Links da navegação', description: 'Cor de Início, Catálogo e Minha Seleção quando não estão selecionados.' },
      { key: 'headerNavActive', label: 'Link ativo da navegação', description: 'Cor do item correspondente à página atual, incluindo seu sublinhado.' },
      { key: 'headerNavHover', label: 'Links ao passar o mouse', description: 'Cor usada ao passar o cursor sobre os links da navegação.' },
      { key: 'headerWhatsappText', label: 'WhatsApp no cabeçalho', description: 'Cor do link de WhatsApp exibido na navegação superior.' },
    ],
  },
  {
    title: 'Fundos',
    fields: [
      { key: 'cream', label: 'Fundo principal do site', description: 'Usado nos fundos claros configurados das páginas e blocos do catálogo.' },
      { key: 'sand', label: 'Fundo das seções de destaque', description: 'Usado na faixa de diferenciais e em outras áreas configuradas com o tom areia.' },
    ],
  },
  {
    title: 'Botões',
    fields: [
      { key: 'clay', label: 'Cor dos botões em tom terroso', description: 'Usada em ações como “Ver peças” e no botão de encomenda pelo WhatsApp.' },
      { key: 'buttonText', label: 'Texto dos botões principais', description: 'Cor exibida sobre os botões configurados com as cores de ação do site.' },
    ],
  },
  {
    title: 'Textos',
    fields: [
      { key: 'text', label: 'Texto principal e títulos', description: 'Cor padrão herdada por títulos e textos de maior destaque.' },
      { key: 'textMuted', label: 'Texto secundário', description: 'Usado em descrições, informações complementares e textos menores.' },
      { key: 'textOnDark', label: 'Texto sobre fundos escuros', description: 'Cor padrão para textos claros; botões usam a configuração específica de texto dos botões.' },
    ],
  },
];

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
  headerBackground: '#52604a',
  headerNavText: '#ffffff',
  headerNavActive: '#ffffff',
  headerNavHover: '#ffffff',
  headerWhatsappText: '#ffffff',
  whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
};

function colorValues(values: Values) {
  return Object.fromEntries(colorKeys.map((key) => [key, values[key] ?? defaults[key]])) as Record<ColorKey, string>;
}

function normalizedColors(values: Values) {
  const colors = colorValues(values);
  for (const key of colorKeys) {
    const normalized = normalizeHex(colors[key]);
    if (!normalized) return { colors: null, error: `Informe uma cor HEX válida para “${colorGroups.flatMap((group) => group.fields).find((field) => field.key === key)?.label ?? key}”.` };
    colors[key] = normalized;
  }
  return { colors, error: '' };
}

function contrastRatio(first: string, second: string) {
  const firstRgb = hexToRgb(first);
  const secondRgb = hexToRgb(second);
  if (!firstRgb || !secondRgb) return null;
  const luminance = (rgb: readonly number[]) => {
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(firstRgb), luminance(secondRgb)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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
  const resolvedTheme = {
    ...theme,
    headerBackground: theme.headerBackground ?? theme.forest ?? defaults.headerBackground,
    headerNavText: theme.headerNavText ?? theme.buttonText ?? defaults.headerNavText,
    headerNavActive: theme.headerNavActive ?? theme.buttonText ?? defaults.headerNavActive,
    headerNavHover: theme.headerNavHover ?? theme.buttonText ?? defaults.headerNavHover,
    headerWhatsappText: theme.headerWhatsappText ?? theme.buttonText ?? defaults.headerWhatsappText,
  };
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
      ...resolvedTheme,
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
  const [savedColors, setSavedColors] = useState<Record<ColorKey, string>>(colorValues(defaults));
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
        setSavedColors(colorValues(loaded.values));
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
        setSavedColors(colorValues(loaded.values));
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
  const updateColor = (key: ColorKey, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const previewColors = colorKeys.reduce((result, key) => ({ ...result, [key]: normalizeHex(values[key]) ?? savedColors[key] ?? defaults[key] }), {} as Record<ColorKey, string>);
  const hasUnsavedColors = colorKeys.some((key) => (normalizeHex(values[key]) ?? values[key].trim()) !== (normalizeHex(savedColors[key]) ?? savedColors[key].trim()));
  const primaryButtonContrast = contrastRatio(previewColors.forest, previewColors.buttonText);
  const clayButtonContrast = contrastRatio(previewColors.clay, previewColors.buttonText);
  const pageContrast = contrastRatio(previewColors.cream, previewColors.text);
  const headerNavContrast = contrastRatio(previewColors.headerBackground, previewColors.headerNavText);
  const headerBrandContrast = contrastRatio(previewColors.headerBackground, previewColors.brandText);
  const headerWhatsappContrast = contrastRatio(previewColors.headerBackground, previewColors.headerWhatsappText);

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
      const normalizedTheme = normalizedColors(values);
      if (!normalizedTheme.colors) throw new Error(normalizedTheme.error);

      if (file) uploadedImageUrl = await uploadImage(file, 'site');
      const heroImage = uploadedImageUrl ?? values.heroImage;

      // A capa é persistida por último: se uma revisão anterior conflitar, a nova imagem ainda não foi referenciada.
      const rows: SettingMutation[] = [
        { key: 'brand', value: { name: values.brandName, tagline: values.tagline, footer: values.footer } },
        { key: 'contact', value: { phone: values.phone, whatsappNumber, whatsappUrl: `https://wa.me/${whatsappNumber}` } },
        { key: 'social', value: { instagramUrl: instagramUrl ?? '' } },
        { key: 'theme', value: normalizedTheme.colors },
        { key: 'hero', value: { title: values.heroTitle, description: values.heroDescription, buttonText: values.heroButton, imageUrl: heroImage } },
      ];

      persistenceStarted = true;
      const nextRevisions = await persistSettings(rows);
      setRevisions(nextRevisions);
      setStoredHeroImage(heroImage);
      setValues((current) => ({ ...current, ...normalizedTheme.colors, heroImage, whatsappNumber, instagramUrl: instagramUrl ?? '' }));
      setSavedColors(normalizedTheme.colors);
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
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Cores</h2><p className="mt-1 text-sm text-[#6e6254]">Escolha, compare e revise as cores antes de salvar.</p></div>{hasUnsavedColors && <p className="rounded-full bg-[#f2e1bd] px-3 py-1 text-xs font-semibold text-[#5c482d]">Alterações de cores não salvas</p>}</div>
        <div className="mt-6 space-y-6">{colorGroups.map((group) => <section key={group.title}><h3 className="text-xs font-bold uppercase tracking-[.16em] text-[#6e6254]">{group.title}</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{group.fields.map((setting) => <ColorSettingField key={setting.key} id={`theme-${setting.key}`} label={setting.label} description={setting.description} value={values[setting.key] ?? ''} savedValue={savedColors[setting.key] ?? defaults[setting.key]} onChange={(value) => updateColor(setting.key, value)} onRestore={() => updateColor(setting.key, savedColors[setting.key] ?? defaults[setting.key])} />)}</div></section>)}</div>
        <section className="mt-7 rounded-lg border border-[#d7cabc] bg-[#fffdf9] p-4"><h3 className="font-serif text-xl text-[#302518]">Prévia</h3><p className="mt-1 text-xs text-[#6e6254]">Esta amostra acompanha as cores escolhidas, mas só será publicada depois de salvar.</p><div className="mt-4 overflow-hidden rounded-md border border-[#d7cabc]" style={{ backgroundColor: previewColors.cream, color: previewColors.text }}><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3" style={{ backgroundColor: previewColors.headerBackground }}><strong className="font-serif text-lg" style={{ color: previewColors.brandText }}>Tear & Aconchego</strong><div className="flex flex-wrap items-center gap-3 text-xs"><span style={{ color: previewColors.headerNavText }}>Início</span><span className="font-semibold underline underline-offset-4" style={{ color: previewColors.headerNavActive }}>Catálogo</span><span style={{ color: previewColors.headerNavText }}>Minha Seleção (1)</span><span style={{ color: previewColors.headerWhatsappText }}>WhatsApp ↗</span></div></div><div className="p-5"><h4 className="font-serif text-2xl" style={{ color: previewColors.text }}>Feito à mão. Pensado para acolher.</h4><p className="mt-2 text-sm" style={{ color: previewColors.textMuted }}>Uma pequena amostra para visualizar títulos, textos e ações.</p><div className="mt-4 flex flex-wrap gap-3"><span className="rounded px-4 py-2 text-xs font-bold" style={{ backgroundColor: previewColors.forest, color: previewColors.buttonText }}>CONHEÇA O CATÁLOGO</span><span className="rounded px-4 py-2 text-xs font-bold" style={{ backgroundColor: previewColors.clay, color: previewColors.buttonText }}>VER PEÇAS</span></div></div><div className="px-5 py-3 text-xs" style={{ backgroundColor: previewColors.sand, color: previewColors.text }}>Seção de destaque</div></div>
          {((primaryButtonContrast !== null && primaryButtonContrast < 4.5) || (clayButtonContrast !== null && clayButtonContrast < 4.5) || (pageContrast !== null && pageContrast < 4.5) || (headerNavContrast !== null && headerNavContrast < 4.5) || (headerBrandContrast !== null && headerBrandContrast < 4.5) || (headerWhatsappContrast !== null && headerWhatsappContrast < 4.5)) && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">Contraste baixo — este texto pode ficar difícil de ler.{(headerNavContrast !== null && headerNavContrast < 4.5) || (headerBrandContrast !== null && headerBrandContrast < 4.5) || (headerWhatsappContrast !== null && headerWhatsappContrast < 4.5) ? ' Revise as cores do cabeçalho.' : ''}{(primaryButtonContrast !== null && primaryButtonContrast < 4.5) || (clayButtonContrast !== null && clayButtonContrast < 4.5) ? ' Revise a combinação dos botões.' : ''}{pageContrast !== null && pageContrast < 4.5 ? ' Revise a combinação do fundo principal e texto.' : ''}</div>}
        </section>
      </section>
      <button disabled={saving} className="rounded bg-[#52604a] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}</button>
      {message && <p role="status">{message}</p>}
    </form>}
  </main>;
}
