'use client';
/* eslint-disable @next/next/no-img-element -- Miniaturas usam URLs públicas dinâmicas do Storage. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_VARIANT_IMAGES, sortVariantImages } from '@/lib/product-images';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import { createClient } from '@/lib/supabase/client';
import { removeCatalogImageIfUnused } from '@/lib/supabase/image-cleanup';
import type { ProductVariantImage } from '@/types/catalog';

type VariantImagesEditorProps = {
  productName: string;
  variantId: string;
  colorName: string;
  images: ProductVariantImage[];
  enabled: boolean;
  onChanged: () => Promise<void>;
};

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export default function VariantImagesEditor({ productName, variantId, colorName, images, enabled, onChanged }: VariantImagesEditorProps) {
  const [supabase] = useState(() => createClient());
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orderedImages = useMemo(() => sortVariantImages(images), [images]);
  const previewUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);

  const chooseFiles = (selected: FileList | null) => {
    const next = selected ? Array.from(selected) : [];
    if (orderedImages.length + next.length > MAX_VARIANT_IMAGES) {
      setFiles([]);
      setMessage(`Máximo de ${MAX_VARIANT_IMAGES} imagens por cor.`);
      return;
    }
    setFiles(next);
    setMessage('');
  };

  const uploadSelected = async () => {
    if (!enabled || uploading || files.length === 0) return;
    if (orderedImages.length + files.length > MAX_VARIANT_IMAGES) {
      setMessage(`Máximo de ${MAX_VARIANT_IMAGES} imagens por cor.`);
      return;
    }

    setUploading(true);
    setMessage('');
    const failures: Array<{ file: File; reason: string }> = [];
    let successes = 0;
    let nextOrder = orderedImages.length ? Math.max(...orderedImages.map((image) => image.sort_order)) + 1 : 0;
    let hasImage = orderedImages.length > 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgress(`Enviando ${index + 1} de ${files.length} imagens…`);
      let uploadedUrl: string | null = null;
      try {
        uploadedUrl = await uploadImage(file, 'products');
        const { error } = await supabase.from('product_variant_images').insert({
          product_variant_id: variantId,
          image_url: uploadedUrl,
          sort_order: nextOrder,
          is_primary: !hasImage,
        });
        if (error) throw error;
        nextOrder += 1;
        hasImage = true;
        successes += 1;
      } catch (error) {
        if (uploadedUrl) {
          try { await removeImage(uploadedUrl); }
          catch { /* O erro principal do arquivo continua visível. */ }
        }
        failures.push({ file, reason: messageFrom(error, 'Falha ao enviar esta imagem.') });
      }
    }

    setProgress('');
    setFiles(failures.map((failure) => failure.file));
    if (failures.length === 0 && fileInputRef.current) fileInputRef.current.value = '';
    let refreshWarning = '';
    if (successes) {
      try { await onChanged(); }
      catch (error) { refreshWarning = ` A galeria não pôde ser atualizada: ${messageFrom(error, 'recarregue a página')}`; }
    }
    if (failures.length) {
      setMessage(`${successes} ${successes === 1 ? 'imagem enviada' : 'imagens enviadas'}; ${failures.length} ${failures.length === 1 ? 'falhou' : 'falharam'}: ${failures.map((failure) => `${failure.file.name} — ${failure.reason}`).join(' | ')}${refreshWarning}`);
    } else {
      setMessage(`${successes} ${successes === 1 ? 'imagem enviada com sucesso.' : 'imagens enviadas com sucesso.'}${refreshWarning}`);
    }
    setUploading(false);
  };

  const setPrimary = async (image: ProductVariantImage) => {
    if (!enabled || uploading || image.is_primary) return;
    setUploading(true);
    setMessage('');
    const previous = orderedImages.find((item) => item.is_primary);
    try {
      if (previous) {
        const { error } = await supabase.from('product_variant_images').update({ is_primary: false }).eq('id', previous.id);
        if (error) throw error;
      }
      const { error } = await supabase.from('product_variant_images').update({ is_primary: true }).eq('id', image.id);
      if (error) throw error;
      try { await onChanged(); setMessage('Imagem principal atualizada.'); }
      catch (refreshError) { setMessage(`Imagem principal atualizada, mas a galeria não pôde ser recarregada: ${messageFrom(refreshError, 'recarregue a página')}`); }
    } catch (error) {
      if (previous) await supabase.from('product_variant_images').update({ is_primary: true }).eq('id', previous.id);
      setMessage(messageFrom(error, 'Não foi possível definir a imagem principal.'));
    } finally {
      setUploading(false);
    }
  };

  const move = async (image: ProductVariantImage, direction: -1 | 1) => {
    if (!enabled || uploading) return;
    const index = orderedImages.findIndex((item) => item.id === image.id);
    const neighbor = orderedImages[index + direction];
    if (!neighbor || neighbor.is_primary || image.is_primary) return;
    setUploading(true);
    setMessage('');
    const firstOrder = image.sort_order;
    const secondOrder = neighbor.sort_order;
    try {
      const [first, second] = await Promise.all([
        supabase.from('product_variant_images').update({ sort_order: secondOrder }).eq('id', image.id),
        supabase.from('product_variant_images').update({ sort_order: firstOrder }).eq('id', neighbor.id),
      ]);
      const error = first.error ?? second.error;
      if (error) setMessage(`Não foi possível alterar a ordem: ${error.message}`);
      else {
        try { await onChanged(); setMessage('Ordem das imagens atualizada.'); }
        catch (refreshError) { setMessage(`Ordem atualizada, mas a galeria não pôde ser recarregada: ${messageFrom(refreshError, 'recarregue a página')}`); }
      }
    } finally {
      setUploading(false);
    }
  };

  const remove = async (image: ProductVariantImage) => {
    if (!enabled || uploading || !window.confirm(`Excluir esta imagem da cor ${colorName}?`)) return;
    setUploading(true);
    setMessage('');
    const { data, error } = await supabase.from('product_variant_images').delete().eq('id', image.id).select('id').maybeSingle();
    if (error || !data) {
      setMessage(error?.message ?? 'A imagem não foi encontrada ou já foi alterada.');
      setUploading(false);
      return;
    }

    const remaining = orderedImages.filter((item) => item.id !== image.id);
    const warnings: string[] = [];
    if (image.is_primary && remaining.length) {
      const { error: primaryError } = await supabase.from('product_variant_images').update({ is_primary: true }).eq('id', remaining[0].id);
      if (primaryError) warnings.push('A próxima imagem será usada visualmente, mas não pôde ser marcada como principal.');
    }
    const { error: legacyError } = await supabase
      .from('product_variants')
      .update({ image_url: null })
      .eq('id', variantId)
      .eq('image_url', image.image_url);
    if (legacyError) warnings.push('A referência antiga da imagem não pôde ser limpa.');
    try { await removeCatalogImageIfUnused(image.image_url); }
    catch (storageError) { warnings.push(messageFrom(storageError, 'O arquivo não pôde ser removido do Storage.')); }
    try { await onChanged(); }
    catch (refreshError) { warnings.push(`A galeria não pôde ser recarregada: ${messageFrom(refreshError, 'recarregue a página')}`); }
    setMessage(warnings.length ? `Imagem excluída. ${warnings.join(' ')}` : 'Imagem excluída.');
    setUploading(false);
  };

  return <section className="mt-4 border-t border-[#d7cabc] pt-4" aria-label={`Imagens da cor ${colorName}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-serif text-lg">Imagens da cor</h3><p className="text-xs">{orderedImages.length} de {MAX_VARIANT_IMAGES} imagens</p></div>
      {!enabled && <span className="rounded bg-[#f5e2ba] px-3 py-1 text-xs">Aguardando a migration de imagens</span>}
    </div>

    {orderedImages.length > 0 ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{orderedImages.map((image, index) => { const firstMovableIndex = orderedImages[0]?.is_primary ? 1 : 0; return <article key={image.id} className="rounded border border-[#c6b8a8] bg-[#fffdf9] p-2">
      <div className="relative aspect-square overflow-hidden rounded bg-[#eee5d8]"><img src={image.image_url} alt={`${productName} — cor ${colorName} — imagem ${index + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />{image.is_primary && <span className="absolute left-2 top-2 rounded-full bg-[#52604a] px-2 py-1 text-[10px] font-bold text-white">★ PRINCIPAL</span>}</div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <button type="button" disabled={uploading || index <= firstMovableIndex || image.is_primary || !enabled} onClick={() => void move(image, -1)} aria-label={`Mover imagem ${index + 1} para a esquerda`} className="rounded border px-2 py-1 text-xs disabled:opacity-35">←</button>
        <button type="button" disabled={uploading || index === orderedImages.length - 1 || image.is_primary || !enabled} onClick={() => void move(image, 1)} aria-label={`Mover imagem ${index + 1} para a direita`} className="rounded border px-2 py-1 text-xs disabled:opacity-35">→</button>
      </div>
      {!image.is_primary && <button type="button" disabled={uploading || !enabled} onClick={() => void setPrimary(image)} aria-label={`Definir imagem ${index + 1} como principal`} className="mt-2 w-full text-xs underline disabled:opacity-40">Definir como principal</button>}
      <button type="button" disabled={uploading || !enabled} onClick={() => void remove(image)} aria-label={`Excluir imagem ${index + 1} da cor ${colorName}`} className="mt-2 w-full text-xs text-red-700 underline disabled:opacity-40">Excluir imagem</button>
    </article>; })}</div> : <p className="mt-3 rounded bg-[#eee5d8] p-3 text-sm">Esta cor ainda não possui imagens. O catálogo usará a foto principal do produto.</p>}

    <div className="mt-4 rounded bg-[#eee8df] p-3">
      <label className="block text-sm font-semibold">Adicionar imagens
        <input ref={fileInputRef} type="file" multiple accept={CATALOG_IMAGE_ACCEPT} disabled={!enabled || uploading || orderedImages.length >= MAX_VARIANT_IMAGES} onChange={(event) => chooseFiles(event.target.files)} className="mt-2 block w-full" />
      </label>
      {previewUrls.length > 0 && <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="Prévia das imagens selecionadas">{previewUrls.map((url, index) => <img key={url} src={url} alt={`Prévia de ${files[index].name}`} className="h-20 w-20 shrink-0 rounded border object-cover" />)}</div>}
      <button type="button" disabled={!enabled || uploading || files.length === 0} onClick={() => void uploadSelected()} className="mt-3 rounded bg-[#52604a] px-4 py-2 text-xs font-bold text-white disabled:opacity-45">{uploading ? progress || 'PROCESSANDO…' : `ENVIAR ${files.length || ''} ${files.length === 1 ? 'IMAGEM' : 'IMAGENS'}`}</button>
    </div>
    {(progress || message) && <p className="mt-3 text-sm" role="status" aria-live="polite">{progress || message}</p>}
  </section>;
}
