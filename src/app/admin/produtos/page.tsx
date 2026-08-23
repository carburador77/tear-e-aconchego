'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addCustomPriceText } from '@/lib/product-price-labels';
import { sortProductsAlphabetically } from '@/lib/product-utils';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import { defaultProductWhatsAppMessage, getCustomProductWhatsAppMessage } from '@/lib/whatsapp';
import type { CatalogProduct, Category, Product, Subcategory } from '@/types/catalog';

type ProductForm = { id?: string; updated_at?: string; category_id: string; subcategory_id: string; name: string; description: string; price: string; image_url: string; origin: string; dimensions: string; care: string; whatsapp_url: string };
const emptyForm: ProductForm = { category_id: '', subcategory_id: '', name: '', description: '', price: '', image_url: '', origin: '', dimensions: '', care: '', whatsapp_url: '' };
const makeSlug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function ProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subcategoriesReady, setSubcategoriesReady] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const [categoryResult, subcategoryResult, productResult, labelsResult] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('subcategories').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle(),
    ]);
    const error = categoryResult.error ?? productResult.error ?? labelsResult.error;
    if (error) throw error;
    setCategories((categoryResult.data ?? []) as Category[]);
    setSubcategories(sortProductsAlphabetically((subcategoryResult.data ?? []) as Subcategory[]));
    setSubcategoriesReady(!subcategoryResult.error);
    const labels = (labelsResult.data?.value ?? {}) as Record<string, string>;
    setProducts(sortProductsAlphabetically(addCustomPriceText((productResult.data ?? []) as Product[], labels)));
  };
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('subcategories').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle(),
    ]).then(([categoryResult, subcategoryResult, productResult, labelsResult]) => {
      const error = categoryResult.error ?? productResult.error ?? labelsResult.error;
      if (error) throw error;
      if (!active) return;
      setCategories((categoryResult.data ?? []) as Category[]);
      setSubcategories(sortProductsAlphabetically((subcategoryResult.data ?? []) as Subcategory[]));
      setSubcategoriesReady(!subcategoryResult.error);
      const labels = (labelsResult.data?.value ?? {}) as Record<string, string>;
      setProducts(sortProductsAlphabetically(addCustomPriceText((productResult.data ?? []) as Product[], labels)));
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os produtos.');
    });
    return () => { active = false; };
  }, [supabase]);
  const update = (field: keyof ProductForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const updateCategory = (categoryId: string) => setForm((current) => ({ ...current, category_id: categoryId, subcategory_id: '' }));
  const cancelEdit = () => { setForm(emptyForm); setImageFile(null); setMessage(''); };
  const editProduct = (product: CatalogProduct) => { setImageFile(null); setMessage(`Editando: ${product.name}`); setForm({ id: product.id, updated_at: product.updated_at, category_id: product.category_id, subcategory_id: product.subcategory_id ?? '', name: product.name, description: product.description ?? '', price: product.custom_price_text ?? product.price?.toString() ?? '', image_url: product.image_url ?? '', origin: product.origin ?? '', dimensions: product.dimensions ?? '', care: product.care ?? '', whatsapp_url: product.whatsapp_url ?? '' }); };
  const readPriceLabels = async () => { const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle(); if (error) throw error; return { ...((data?.value ?? {}) as Record<string, string>) }; };
  const savePriceLabel = async (productId: string, label: string) => { const labels = await readPriceLabels(); if (label) labels[productId] = label; else delete labels[productId]; const { error } = await supabase.from('site_settings').upsert({ key: 'product_price_labels', value: labels }); if (error) throw error; };
  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    let uploadedImage: string | null = null;
    let productPersisted = false;
    try {
      const name = form.name.trim();
      const slug = makeSlug(name);
      if (!slug) throw new Error('O nome precisa conter pelo menos uma letra ou número.');
      let imageUrl = form.image_url.trim() || null;
      if (imageUrl) {
        const protocol = new URL(imageUrl).protocol;
        if (protocol !== 'http:' && protocol !== 'https:') throw new Error('A URL da imagem precisa começar com http:// ou https://.');
      }
      if (imageFile) {
        uploadedImage = await uploadImage(imageFile, 'products');
        imageUrl = uploadedImage;
      }
      const enteredPrice = form.price.trim();
      const parsedPrice = enteredPrice ? Number(enteredPrice.replace(',', '.')) : null;
      const numericPrice = parsedPrice !== null && Number.isFinite(parsedPrice);
      if (numericPrice && parsedPrice < 0) throw new Error('O preço não pode ser negativo.');
      const priceLabel = enteredPrice && !numericPrice ? enteredPrice : '';
      if (priceLabel.length > 100) throw new Error('O texto do preço deve ter no máximo 100 caracteres.');
      const row = { category_id: form.category_id, ...(subcategoriesReady ? { subcategory_id: form.subcategory_id || null } : {}), name, slug, description: form.description.trim(), price: priceLabel ? null : parsedPrice, image_url: imageUrl, origin: form.origin.trim() || null, dimensions: form.dimensions.trim() || null, care: form.care.trim() || null, whatsapp_url: form.whatsapp_url.trim() || null };

      const persist = () => {
        if (!form.id) return supabase.from('products').insert(row).select('id').single();
        let query = supabase.from('products').update(row).eq('id', form.id);
        if (form.updated_at) query = query.eq('updated_at', form.updated_at);
        return query.select('id').maybeSingle();
      };
      const result = await persist();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Este produto foi alterado em outra aba. Recarregue a página antes de salvar novamente.');
      productPersisted = true;

      let warning = '';
      try { await savePriceLabel(result.data.id, priceLabel); }
      catch { warning = ' O produto foi salvo, mas o texto personalizado do preço não pôde ser atualizado.'; }
      if (uploadedImage && form.image_url && form.image_url !== uploadedImage) {
        try { await removeImage(form.image_url); }
        catch { warning += ' A foto anterior não pôde ser removida do armazenamento e poderá exigir limpeza posterior.'; }
      }
      cancelEdit();
      try {
        await load();
        setMessage(`Produto salvo com sucesso.${warning}`);
      } catch (refreshError) {
        const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Não foi possível atualizar a lista.';
        setMessage(`Produto salvo com sucesso.${warning} A lista não pôde ser atualizada: ${refreshMessage}`);
      }
    } catch (error) {
      if (uploadedImage && !productPersisted) {
        try { await removeImage(uploadedImage); } catch { /* Mantém o erro principal; a limpeza é reportada na auditoria. */ }
      }
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o produto.');
    } finally { setSaving(false); }
  };
  const deleteProduct = async (product: CatalogProduct) => {
    if (!window.confirm(`Excluir definitivamente o produto “${product.name}”?`)) return;
    setMessage('');
    const { data: variants, error: variantsError } = await supabase.from('product_variants').select('image_url').eq('product_id', product.id);
    if (variantsError) { setMessage(`Não foi possível verificar as imagens das variações: ${variantsError.message}`); return; }
    let deleteQuery = supabase.from('products').delete().eq('id', product.id);
    if (product.updated_at) deleteQuery = deleteQuery.eq('updated_at', product.updated_at);
    const { data: deletedProduct, error } = await deleteQuery.select('id').maybeSingle();
    if (error) { setMessage(error.message); return; }
    if (!deletedProduct) { setMessage('Este produto foi alterado em outra aba. Recarregue a página antes de excluí-lo.'); return; }

    let cleanupWarning = '';
    try { await savePriceLabel(product.id, ''); }
    catch { cleanupWarning = ' O texto personalizado do preço não pôde ser limpo.'; }
    const imageUrls = [product.image_url, ...(variants ?? []).map((variant) => variant.image_url)].filter((url): url is string => Boolean(url));
    const cleanupResults = await Promise.allSettled(imageUrls.map((url) => removeImage(url)));
    if (cleanupResults.some((result) => result.status === 'rejected')) cleanupWarning += ' Uma ou mais imagens não puderam ser removidas do armazenamento.';
    if (form.id === product.id) cancelEdit();
    try {
      await load();
      setMessage(`Produto excluído com sucesso.${cleanupWarning}`);
    } catch (refreshError) {
      const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Não foi possível atualizar a lista.';
      setMessage(`Produto excluído com sucesso.${cleanupWarning} A lista não pôde ser atualizada: ${refreshMessage}`);
    }
  };
  const whatsappPreview = getCustomProductWhatsAppMessage(form.whatsapp_url) ?? defaultProductWhatsAppMessage(form.name || 'este produto');
  const availableSubcategories = subcategories.filter((subcategory) => subcategory.category_id === form.category_id && (subcategory.active || subcategory.id === form.subcategory_id));
  return <main className="mx-auto max-w-5xl p-4 sm:p-6"><Link href="/admin" className="text-sm underline">← Voltar ao painel</Link><h1 className="mt-4 font-serif text-3xl text-[#302518]">Produtos</h1><p className="mt-1 text-sm text-[#6e6254]">Crie, edite ou exclua as peças do catálogo.</p><div className="mt-5 flex flex-wrap gap-3"><a href="#novo-produto" onClick={cancelEdit} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white">+ Novo produto</a><Link href="/admin/produtos/cadastro-em-lote" className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">+ Cadastro em lote</Link><Link href="/admin/produtos/edicao-em-lote" className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">Edição em lote</Link></div><form id="novo-produto" onSubmit={saveProduct} className="mt-5 grid gap-3 rounded-lg bg-[#f2ece3] p-4 shadow-sm sm:grid-cols-2"><h2 className="font-serif text-xl text-[#302518] sm:col-span-2">{form.id ? 'Editar produto' : 'Novo produto'}</h2><label className="text-sm text-[#4c4034]">Categoria<select required value={form.category_id} onChange={(event) => updateCategory(event.target.value)}><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm text-[#4c4034]">Subcategoria<select value={form.subcategory_id} disabled={!form.category_id || !subcategoriesReady} onChange={(event) => update('subcategory_id', event.target.value)}><option value="">Sem subcategoria</option>{availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{!subcategory.active && ' (inativa)'}</option>)}</select></label><label className="text-sm text-[#4c4034]">Nome do produto<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label><label className="text-sm text-[#4c4034]">Descrição<textarea rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} /></label><label className="text-sm text-[#4c4034]">Preço ou texto personalizado<input placeholder="Ex.: 229,00 ou Sob Consulta" value={form.price} onChange={(event) => update('price', event.target.value)} /></label><label className="text-sm text-[#4c4034]">Origem / material<textarea rows={3} placeholder="Ex.: 100% fio têxtil natural, feito à mão" value={form.origin} onChange={(event) => update('origin', event.target.value)} /></label><label className="text-sm text-[#4c4034]">Dimensões<input placeholder="Ex.: 39 × 39 cm" value={form.dimensions} onChange={(event) => update('dimensions', event.target.value)} /></label><label className="text-sm text-[#4c4034] sm:col-span-2">Cuidados<textarea rows={3} placeholder="Ex.: Lavar à mão em água fria. Secar à sombra." value={form.care} onChange={(event) => update('care', event.target.value)} /></label><label className="text-sm text-[#4c4034] sm:col-span-2">Mensagem personalizada do WhatsApp (opcional)<textarea rows={2} placeholder="Digite somente a mensagem" value={form.whatsapp_url} onChange={(event) => update('whatsapp_url', event.target.value)} /><span className="mt-1 block text-xs font-normal">Deixe em branco para usar automaticamente o nome do produto.</span><span className="mt-2 block text-xs font-normal">Mensagem que será enviada: {whatsappPreview}</span></label><label className="text-sm text-[#4c4034] sm:col-span-2">URL personalizada da imagem (opcional)<input type="url" value={form.image_url} onChange={(event) => update('image_url', event.target.value)} /></label><label className="text-sm text-[#4c4034] sm:col-span-2">Enviar foto do produto<input type="file" accept={CATALOG_IMAGE_ACCEPT} onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label><div className="flex gap-3 sm:col-span-2"><button disabled={saving} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'SALVANDO...' : 'SALVAR PRODUTO'}</button>{form.id && <button type="button" onClick={cancelEdit} className="rounded border border-[#786e60] px-4 py-2 text-sm">Cancelar</button>}</div></form>{message && <p role="status" className="mt-3 text-sm text-[#4c4034]">{message}</p>}<section className="mt-7 space-y-2">{products.map((product) => <article key={product.id} className="flex flex-wrap items-center gap-3 rounded border border-[#a99c8c] bg-white p-3"><span className="min-w-0 flex-1 font-medium text-[#302518]">{product.name}</span><button type="button" onClick={() => editProduct(product)} className="text-sm underline">Editar</button><Link className="text-sm underline" href={`/admin/produtos/${product.id}/variacoes`}>Cores / Variações</Link><button type="button" onClick={() => void deleteProduct(product)} className="text-sm text-red-700 underline">Excluir</button></article>)}</section></main>;
}
