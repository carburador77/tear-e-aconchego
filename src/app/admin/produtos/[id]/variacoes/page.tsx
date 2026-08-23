'use client';
/* eslint-disable @next/next/no-img-element -- As imagens vêm de URLs configuráveis do catálogo. */

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import type { ProductVariant } from '@/types/catalog';

type VariantRow = ProductVariant & { updated_at: string };
type VariantForm = {
  id?: string;
  updated_at?: string;
  color_name: string;
  color_hex: string;
  image_url: string;
  display_order: number;
  active: boolean;
  is_default: boolean;
};
type ClearedDefault = { id: string; updated_at: string };

const emptyForm = (): VariantForm => ({
  color_name: '',
  color_hex: '#D8C3A5',
  image_url: '',
  display_order: 0,
  active: true,
  is_default: false,
});

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
}

function conflictError() {
  return new Error('Esta variação foi alterada em outra aba ou sessão. Recarregue a lista e tente novamente.');
}

async function cleanupImage(url: string) {
  try {
    await removeImage(url);
    return null;
  } catch (error) {
    return errorMessage(error, 'Não foi possível limpar a imagem.');
  }
}

export default function Variants({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<VariantRow[]>([]);
  const [form, setForm] = useState<VariantForm>(() => emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchVariants = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', id)
      .order('is_default', { ascending: false })
      .order('display_order');
    if (error) throw error;
    return (data ?? []) as VariantRow[];
  }, [id, supabase]);

  useEffect(() => {
    let ignore = false;
    void fetchVariants()
      .then((rows) => { if (!ignore) setItems(rows); })
      .catch((error: unknown) => { if (!ignore) setMessage(errorMessage(error, 'Não foi possível carregar as variações.')); });
    return () => { ignore = true; };
  }, [fetchVariants]);

  const refreshVariants = useCallback(async () => {
    const rows = await fetchVariants();
    setItems(rows);
  }, [fetchVariants]);

  const cancelEdit = () => {
    setForm(emptyForm());
    setFile(null);
  };

  const edit = (variant: VariantRow) => {
    setForm({
      id: variant.id,
      updated_at: variant.updated_at,
      color_name: variant.color_name,
      color_hex: variant.color_hex,
      image_url: variant.image_url ?? '',
      display_order: variant.display_order,
      active: variant.active,
      is_default: variant.is_default,
    });
    setFile(null);
  };

  const restoreDefaults = async (cleared: ClearedDefault[]) => {
    let failures = 0;
    for (const previous of [...cleared].reverse()) {
      const { data, error } = await supabase
        .from('product_variants')
        .update({ is_default: true })
        .eq('id', previous.id)
        .eq('updated_at', previous.updated_at)
        .select('id')
        .maybeSingle();
      if (error || !data) failures += 1;
    }
    return failures;
  };

  const persistVariant = async (imageUrl: string | null) => {
    const clearedDefaults: ClearedDefault[] = [];
    try {
      if (form.is_default) {
        const previousDefaults = items.filter((variant) => variant.is_default && variant.id !== form.id);
        for (const previous of previousDefaults) {
          const { data, error } = await supabase
            .from('product_variants')
            .update({ is_default: false })
            .eq('id', previous.id)
            .eq('updated_at', previous.updated_at)
            .select('id,updated_at')
            .maybeSingle();
          if (error) throw error;
          if (!data) throw conflictError();
          clearedDefaults.push({ id: data.id, updated_at: data.updated_at });
        }
      }

      const values = {
        product_id: id,
        color_name: form.color_name.trim(),
        color_hex: form.color_hex,
        image_url: imageUrl,
        display_order: Number(form.display_order),
        active: form.is_default ? true : form.active,
        is_default: form.is_default,
      };

      if (form.id) {
        if (!form.updated_at) throw conflictError();
        const { data, error } = await supabase
          .from('product_variants')
          .update(values)
          .eq('id', form.id)
          .eq('updated_at', form.updated_at)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw conflictError();
        return data as VariantRow;
      }

      const { data, error } = await supabase.from('product_variants').insert(values).select('*').single();
      if (error) throw error;
      return data as VariantRow;
    } catch (error) {
      const restoreFailures = await restoreDefaults(clearedDefaults);
      const normalizedError = errorCode(error) === '23505' ? conflictError() : error;
      if (restoreFailures) {
        throw new Error(`${errorMessage(normalizedError, 'Não foi possível salvar a variação.')} Também não foi possível restaurar a cor padrão anterior; recarregue a lista antes de continuar.`);
      }
      throw normalizedError;
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');

    const previousImageUrl = form.image_url || null;
    let uploadedImageUrl: string | null = null;

    try {
      if (file) uploadedImageUrl = await uploadImage(file, 'products');
      const imageUrl = uploadedImageUrl ?? previousImageUrl;
      await persistVariant(imageUrl);
    } catch (error) {
      const cleanupError = uploadedImageUrl ? await cleanupImage(uploadedImageUrl) : null;
      const suffix = cleanupError ? ` A nova imagem também não pôde ser removida: ${cleanupError}` : '';
      setMessage(`${errorMessage(error, 'Não foi possível salvar a variação.')}${suffix}`);
      setSaving(false);
      return;
    }

    const warnings: string[] = [];
    if (uploadedImageUrl && previousImageUrl && uploadedImageUrl !== previousImageUrl) {
      const cleanupError = await cleanupImage(previousImageUrl);
      if (cleanupError) warnings.push(`Não foi possível remover a imagem anterior: ${cleanupError}`);
    }

    cancelEdit();
    try {
      await refreshVariants();
    } catch (error) {
      warnings.push(errorMessage(error, 'Não foi possível atualizar a lista.'));
    }
    setMessage(warnings.length ? `Variação salva. ${warnings.join(' ')}` : 'Variação salva.');
    setSaving(false);
  };

  const remove = async (variant: VariantRow) => {
    if (!window.confirm(`Excluir ${variant.color_name}?`)) return;
    setMessage('');

    const { data, error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variant.id)
      .eq('updated_at', variant.updated_at)
      .select('id')
      .maybeSingle();
    if (error) { setMessage(error.message); return; }
    if (!data) { setMessage(conflictError().message); return; }

    const cleanupError = variant.image_url ? await cleanupImage(variant.image_url) : null;
    try {
      await refreshVariants();
    } catch (refreshError) {
      setMessage(`Variação excluída. ${errorMessage(refreshError, 'Não foi possível atualizar a lista.')}`);
      return;
    }
    setMessage(cleanupError
      ? `Variação excluída, mas não foi possível remover a imagem do armazenamento: ${cleanupError}`
      : 'Variação excluída.');
  };

  return <main className="mx-auto max-w-4xl p-6">
    <Link href="/admin" className="text-sm underline">← Voltar ao painel</Link>
    <h1 className="mt-4 font-serif text-3xl">Cores / Variações</h1>
    <form onSubmit={save} className="mt-5 grid gap-3 rounded bg-[#f2ece3] p-4 sm:grid-cols-2">
      <input required placeholder="Nome da cor" value={form.color_name} onChange={(event) => setForm((current) => ({ ...current, color_name: event.target.value }))} />
      <input required type="color" value={form.color_hex} onChange={(event) => setForm((current) => ({ ...current, color_hex: event.target.value }))} />
      <input type="number" placeholder="Ordem" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: Number(event.target.value) }))} />
      <label>Imagem da cor<input type="file" accept={CATALOG_IMAGE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked, active: event.target.checked ? true : current.active }))} /> Cor padrão</label>
      <label><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked, is_default: event.target.checked ? current.is_default : false }))} /> Ativa</label>
      <button disabled={saving} className="rounded bg-[#52604a] p-2 text-white disabled:opacity-60">{saving ? 'SALVANDO...' : form.id ? 'SALVAR' : 'ADICIONAR COR'}</button>
      {form.id && <button type="button" disabled={saving} onClick={cancelEdit}>Cancelar</button>}
    </form>
    {message && <p role="status">{message}</p>}
    <div className="mt-6 space-y-2">{items.map((variant) => <div className="flex items-center gap-3 rounded border p-3" key={variant.id}>
      <i className="h-7 w-7 rounded-full border" style={{ backgroundColor: variant.color_hex }} />
      <span className="flex-1">{variant.color_name}{variant.is_default ? ' · padrão' : ''}</span>
      {variant.image_url && <img className="h-10 w-10 object-cover" src={variant.image_url} alt="" />}
      <button type="button" disabled={saving} onClick={() => edit(variant)}>Editar</button>
      <button type="button" disabled={saving} onClick={() => void remove(variant)}>Excluir</button>
    </div>)}</div>
  </main>;
}
