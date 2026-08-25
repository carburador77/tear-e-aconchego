'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import VariantImagesEditor from '@/components/admin/VariantImagesEditor';
import { isVariantImagesSchemaUnavailable, legacyVariantImage, sortVariantImages } from '@/lib/product-images';
import { createClient } from '@/lib/supabase/client';
import { removeCatalogImageIfUnused } from '@/lib/supabase/image-cleanup';
import type { ProductVariant, ProductVariantImage } from '@/types/catalog';

type VariantRow = ProductVariant & { updated_at: string };
type VariantDatabaseRow = Omit<VariantRow, 'images'>;
type VariantForm = { id?: string; updated_at?: string; color_name: string; color_hex: string; display_order: number; active: boolean; is_default: boolean };
type ClearedDefault = { id: string; updated_at: string };

const emptyForm = (): VariantForm => ({ color_name: '', color_hex: '#D8C3A5', display_order: 0, active: true, is_default: false });

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

export default function Variants({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [supabase] = useState(() => createClient());
  const [productName, setProductName] = useState('Produto');
  const [items, setItems] = useState<VariantRow[]>([]);
  const [form, setForm] = useState<VariantForm>(() => emptyForm());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagesSchemaReady, setImagesSchemaReady] = useState(true);

  const fetchVariants = useCallback(async () => {
    const [productResult, variantsResult] = await Promise.all([
      supabase.from('products').select('name').eq('id', id).maybeSingle(),
      supabase.from('product_variants').select('*').eq('product_id', id).order('is_default', { ascending: false }).order('display_order'),
    ]);
    const baseError = productResult.error ?? variantsResult.error;
    if (baseError) throw baseError;
    const loadedProductName = productResult.data?.name ?? 'Produto';

    const variantRows = (variantsResult.data ?? []) as VariantDatabaseRow[];
    const variantIds = variantRows.map((variant) => variant.id);
    if (!variantIds.length) {
      return { rows: [] as VariantRow[], productName: loadedProductName, schemaReady: true };
    }

    const imagesResult = await supabase.from('product_variant_images').select('*').in('product_variant_id', variantIds).order('is_primary', { ascending: false }).order('sort_order').order('created_at');
    if (imagesResult.error && !isVariantImagesSchemaUnavailable(imagesResult.error)) throw imagesResult.error;
    const schemaReady = !imagesResult.error;
    const grouped = ((imagesResult.data ?? []) as ProductVariantImage[]).reduce((map, image) => {
      map.set(image.product_variant_id, [...(map.get(image.product_variant_id) ?? []), image]);
      return map;
    }, new Map<string, ProductVariantImage[]>());

    const rows = variantRows.map((variant): VariantRow => ({
      ...variant,
      images: schemaReady ? sortVariantImages(grouped.get(variant.id) ?? []) : legacyVariantImage(variant),
    }));
    return { rows, productName: loadedProductName, schemaReady };
  }, [id, supabase]);

  useEffect(() => {
    let ignore = false;
    void fetchVariants()
      .then((result) => {
        if (ignore) return;
        setItems(result.rows);
        setProductName(result.productName);
        setImagesSchemaReady(result.schemaReady);
      })
      .catch((error: unknown) => { if (!ignore) setMessage(errorMessage(error, 'Não foi possível carregar as variações.')); });
    return () => { ignore = true; };
  }, [fetchVariants]);

  const refreshVariants = useCallback(async () => {
    const result = await fetchVariants();
    setItems(result.rows);
    setProductName(result.productName);
    setImagesSchemaReady(result.schemaReady);
  }, [fetchVariants]);

  const cancelEdit = () => setForm(emptyForm());

  const edit = (variant: VariantRow) => {
    setForm({ id: variant.id, updated_at: variant.updated_at, color_name: variant.color_name, color_hex: variant.color_hex, display_order: variant.display_order, active: variant.active, is_default: variant.is_default });
    setMessage(`Editando a cor ${variant.color_name}.`);
  };

  const restoreDefaults = async (cleared: ClearedDefault[]) => {
    let failures = 0;
    for (const previous of [...cleared].reverse()) {
      const { data, error } = await supabase.from('product_variants').update({ is_default: true }).eq('id', previous.id).eq('updated_at', previous.updated_at).select('id').maybeSingle();
      if (error || !data) failures += 1;
    }
    return failures;
  };

  const persistVariant = async () => {
    const clearedDefaults: ClearedDefault[] = [];
    try {
      if (form.is_default) {
        const previousDefaults = items.filter((variant) => variant.is_default && variant.id !== form.id);
        for (const previous of previousDefaults) {
          const { data, error } = await supabase.from('product_variants').update({ is_default: false }).eq('id', previous.id).eq('updated_at', previous.updated_at).select('id,updated_at').maybeSingle();
          if (error) throw error;
          if (!data) throw conflictError();
          clearedDefaults.push({ id: data.id, updated_at: data.updated_at });
        }
      }

      const values = { product_id: id, color_name: form.color_name.trim(), color_hex: form.color_hex, display_order: Number(form.display_order), active: form.is_default ? true : form.active, is_default: form.is_default };
      if (form.id) {
        if (!form.updated_at) throw conflictError();
        const { data, error } = await supabase.from('product_variants').update(values).eq('id', form.id).eq('updated_at', form.updated_at).select('*').maybeSingle();
        if (error) throw error;
        if (!data) throw conflictError();
        return;
      }
      const { error } = await supabase.from('product_variants').insert(values);
      if (error) throw error;
    } catch (error) {
      const restoreFailures = await restoreDefaults(clearedDefaults);
      const normalizedError = errorCode(error) === '23505' ? conflictError() : error;
      if (restoreFailures) throw new Error(`${errorMessage(normalizedError, 'Não foi possível salvar a variação.')} A cor padrão anterior também não pôde ser restaurada; recarregue a página.`);
      throw normalizedError;
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      await persistVariant();
      cancelEdit();
      await refreshVariants();
      setMessage('Cor salva. Agora você pode adicionar ou organizar as imagens diretamente no cartão da cor.');
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível salvar a variação.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (variant: VariantRow) => {
    if (!window.confirm(`Excluir a cor ${variant.color_name} e todas as imagens associadas?`)) return;
    setSaving(true);
    setMessage('');
    const imageUrls = [...new Set([...variant.images.map((image) => image.image_url), variant.image_url].filter((url): url is string => Boolean(url)))];
    const { data, error } = await supabase.from('product_variants').delete().eq('id', variant.id).eq('updated_at', variant.updated_at).select('id').maybeSingle();
    if (error || !data) {
      setMessage(error?.message ?? conflictError().message);
      setSaving(false);
      return;
    }
    const cleanupResults = await Promise.allSettled(imageUrls.map((url) => removeCatalogImageIfUnused(url)));
    try { await refreshVariants(); }
    catch (refreshError) {
      setMessage(`Cor excluída. ${errorMessage(refreshError, 'Não foi possível atualizar a lista.')}`);
      setSaving(false);
      return;
    }
    setMessage(cleanupResults.some((result) => result.status === 'rejected') ? 'Cor excluída, mas um ou mais arquivos exigem limpeza posterior no Storage.' : 'Cor e imagens associadas excluídas.');
    setSaving(false);
  };

  return <main className="mx-auto max-w-5xl p-4 sm:p-6">
    <Link href="/admin/produtos" className="text-sm underline">← Voltar aos produtos</Link>
    <h1 className="mt-4 font-serif text-3xl">Cores / Variações</h1>
    <p className="mt-1 text-sm">{productName} · cada cor pode ter até 8 imagens.</p>
    {!imagesSchemaReady && <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert"><strong>A galeria múltipla ainda não está ativa neste banco.</strong> As imagens antigas continuam visíveis. Aplique a migration 005 somente depois de revisá-la para liberar uploads, ordenação e exclusão individual.</div>}

    <form onSubmit={save} className="mt-5 grid gap-3 rounded bg-[#f2ece3] p-4 sm:grid-cols-2">
      <h2 className="font-serif text-xl sm:col-span-2">{form.id ? 'Editar cor' : 'Adicionar cor'}</h2>
      <label className="text-sm">Nome da cor<input required placeholder="Ex.: Areia" value={form.color_name} onChange={(event) => setForm((current) => ({ ...current, color_name: event.target.value }))} className="mt-1 w-full" /></label>
      <label className="text-sm">Cor hexadecimal<div className="mt-1 flex items-center gap-2"><input required type="color" value={form.color_hex} onChange={(event) => setForm((current) => ({ ...current, color_hex: event.target.value }))} /><input required pattern="#[0-9A-Fa-f]{6}" value={form.color_hex} onChange={(event) => setForm((current) => ({ ...current, color_hex: event.target.value }))} className="min-w-0 flex-1" /></div></label>
      <label className="text-sm">Ordem<input type="number" min="0" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: Number(event.target.value) }))} className="mt-1 w-full" /></label>
      <div className="flex flex-wrap items-center gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked, active: event.target.checked ? true : current.active }))} /> Cor padrão</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked, is_default: event.target.checked ? current.is_default : false }))} /> Ativa</label></div>
      <div className="flex gap-3 sm:col-span-2"><button disabled={saving} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'SALVANDO…' : form.id ? 'SALVAR COR' : 'ADICIONAR COR'}</button>{form.id && <button type="button" disabled={saving} onClick={cancelEdit} className="rounded border px-4 py-2 text-sm">Cancelar</button>}</div>
    </form>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}

    <div className="mt-7 space-y-5">{items.map((variant) => <article className="rounded-lg border border-[#a99c8c] bg-white p-4" key={variant.id}>
      <div className="flex flex-wrap items-center gap-3">
        <i className="h-8 w-8 rounded-full border border-[#8d8173]" style={{ backgroundColor: variant.color_hex }} aria-hidden="true" />
        <div className="min-w-0 flex-1"><h2 className="font-serif text-xl">{variant.color_name}</h2><p className="text-xs">Ordem {variant.display_order}{variant.is_default ? ' · cor padrão' : ''}{!variant.active ? ' · inativa' : ''}</p></div>
        <button type="button" disabled={saving} onClick={() => edit(variant)} className="text-sm underline">Editar cor</button>
        <button type="button" disabled={saving} onClick={() => void remove(variant)} className="text-sm text-red-700 underline">Excluir cor</button>
      </div>
      <VariantImagesEditor productName={productName} variantId={variant.id} colorName={variant.color_name} images={variant.images} enabled={imagesSchemaReady} onChanged={refreshVariants} />
    </article>)}</div>
  </main>;
}
