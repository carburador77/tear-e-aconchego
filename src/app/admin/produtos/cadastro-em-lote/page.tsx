'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { removeImage, uploadImage } from '@/lib/supabase/storage';
import { comparableProductName, isSupportedProductImage, makeProductSlug, nextAvailableProductSlug, productNameFromFile } from '@/lib/product-utils';
import type { Category, Subcategory } from '@/types/catalog';

type ItemStatus = 'ready' | 'uploading' | 'success' | 'error';
type BatchItem = { id: string; file: File; previewUrl: string; name: string; categoryId: string; subcategoryId: string; price: string; allowDuplicate: boolean; status: ItemStatus; error: string; warning: string; slug?: string };
type ExistingProduct = { id: string; name: string; slug: string; display_order: number };
type Result = { success: number; errors: number } | null;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
}

export default function BatchProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const previewUrls = useRef(new Set<string>());
  const idCounter = useRef(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subcategoriesReady, setSubcategoriesReady] = useState(false);
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultSubcategory, setDefaultSubcategory] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('subcategories').select('*').order('name'),
      supabase.from('products').select('id,name,slug,display_order').order('display_order'),
    ]).then(([categoryResult, subcategoryResult, productResult]) => {
      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;
      setCategories(((categoryResult.data ?? []) as Category[]).filter((category) => category.active));
      setSubcategories(((subcategoryResult.data ?? []) as Subcategory[]).filter((subcategory) => subcategory.active));
      setSubcategoriesReady(!subcategoryResult.error);
      setExistingProducts((productResult.data ?? []) as ExistingProduct[]);
    }).catch((error: unknown) => {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar categorias e produtos.'));
    }).finally(() => setLoading(false));
  }, [supabase]);

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const updateItem = (id: string, changes: Partial<BatchItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes, status: item.status === 'success' ? item.status : 'ready', error: item.status === 'success' ? item.error : '', warning: item.status === 'success' ? item.warning : '' } : item));

  const duplicateReason = (item: BatchItem, index: number) => {
    if (item.status === 'success') return '';
    const comparableName = comparableProductName(item.name);
    const slug = makeProductSlug(item.name);
    if (existingProducts.some((product) => comparableProductName(product.name) === comparableName || product.slug === slug)) return 'Já existe um produto com nome semelhante.';
    if (items.slice(0, index).some((other) => other.status !== 'success' && (comparableProductName(other.name) === comparableName || makeProductSlug(other.name) === slug))) return 'Outro item deste lote possui nome semelhante.';
    return '';
  };

  const chooseFiles = (files: FileList | null) => {
    if (!files || !defaultCategory) return;
    const warnings: string[] = [];
    const additions: BatchItem[] = [];
    Array.from(files).forEach((file) => {
      if (!isSupportedProductImage(file)) { warnings.push(`${file.name}: formato não aceito.`); return; }
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      idCounter.current += 1;
      additions.push({ id: `${Date.now()}-${idCounter.current}`, file, previewUrl, name: productNameFromFile(file.name), categoryId: defaultCategory, subcategoryId: defaultSubcategory, price: '', allowDuplicate: false, status: 'ready', error: '', warning: '' });
    });
    setItems((current) => [...current, ...additions]);
    setFileWarnings(warnings);
    setResult(null);
  };

  const changeDefaultCategory = (categoryId: string) => {
    setDefaultCategory(categoryId);
    setDefaultSubcategory('');
  };

  const removeItem = (item: BatchItem) => {
    URL.revokeObjectURL(item.previewUrl);
    previewUrls.current.delete(item.previewUrl);
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };

  const savePriceLabel = async (productId: string, label: string) => {
    if (!label) return;
    const { data, error: readError } = await supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle();
    if (readError) throw readError;
    const labels = (data?.value ?? {}) as Record<string, string>;
    labels[productId] = label;
    const { error } = await supabase.from('site_settings').upsert({ key: 'product_price_labels', value: labels });
    if (error) throw error;
  };

  const registerAll = async () => {
    const candidates = items.filter((item) => item.status !== 'success');
    if (!candidates.length || processing || loadError) return;
    setProcessing(true); setResult(null); setProgress({ current: 0, total: candidates.length, name: '' });
    const { data: latestProductData, error: latestProductError } = await supabase.from('products').select('id,name,slug,display_order').order('display_order');
    if (latestProductError) {
      setLoadError(getErrorMessage(latestProductError, 'Não foi possível verificar os produtos existentes. Recarregue a página e tente novamente.'));
      setProcessing(false);
      return;
    }
    const latestProducts = (latestProductData ?? []) as ExistingProduct[];
    setExistingProducts(latestProducts);
    const unavailableSlugs = new Set(latestProducts.map((product) => product.slug));
    const unavailableNames = new Set(latestProducts.map((product) => comparableProductName(product.name)));
    let nextDisplayOrder = Math.max(0, ...latestProducts.map((product) => product.display_order)) + 1;
    let success = 0; let errors = 0;

    for (let index = 0; index < candidates.length; index += 1) {
      const item = candidates[index];
      setProgress({ current: index + 1, total: candidates.length, name: item.name });
      setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, status: 'uploading', error: '', warning: '' } : currentItem));
      let uploadedImage = '';
      let createdProductId = '';
      try {
        if (!item.name.trim()) throw new Error('Informe o nome do produto.');
        if (!item.categoryId) throw new Error('Selecione uma categoria.');
        const baseSlug = makeProductSlug(item.name);
        if (!baseSlug) throw new Error('O nome precisa conter pelo menos uma letra ou número.');
        const hasDuplicate = unavailableNames.has(comparableProductName(item.name)) || unavailableSlugs.has(baseSlug);
        if (hasDuplicate && !item.allowDuplicate) throw new Error('Já existe um produto com nome semelhante. Altere o nome, remova o item ou autorize a duplicidade.');
        const slug = nextAvailableProductSlug(baseSlug, unavailableSlugs);
        const enteredPrice = item.price.trim();
        const parsedPrice = enteredPrice ? Number(enteredPrice.replace(',', '.')) : null;
        const priceLabel = enteredPrice && Number.isNaN(parsedPrice) ? enteredPrice : '';
        uploadedImage = await uploadImage(item.file, 'products');
        const { data, error } = await supabase.from('products').insert({ category_id: item.categoryId, ...(subcategoriesReady ? { subcategory_id: item.subcategoryId || null } : {}), name: item.name.trim(), slug, description: '', price: priceLabel ? null : parsedPrice, image_url: uploadedImage, origin: null, dimensions: null, care: null, whatsapp_url: null, display_order: nextDisplayOrder, active: true }).select('id').single();
        if (error) throw error;
        createdProductId = data.id;
        try {
          await savePriceLabel(createdProductId, priceLabel);
        } catch (priceError) {
          const { error: rollbackError } = await supabase.from('products').delete().eq('id', createdProductId);
          if (!rollbackError) {
            createdProductId = '';
            await removeImage(uploadedImage);
            uploadedImage = '';
            throw priceError;
          }
          unavailableSlugs.add(slug); unavailableNames.add(comparableProductName(item.name));
          setExistingProducts((current) => [...current, { id: createdProductId, name: item.name.trim(), slug, display_order: nextDisplayOrder }]);
          setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, status: 'success', error: '', warning: `O produto e a imagem foram salvos, mas o preço personalizado não pôde ser gravado: ${getErrorMessage(priceError, 'erro desconhecido')}`, slug } : currentItem));
          success += 1;
          nextDisplayOrder += 1;
          continue;
        }
        unavailableSlugs.add(slug); unavailableNames.add(comparableProductName(item.name));
        setExistingProducts((current) => [...current, { id: createdProductId, name: item.name.trim(), slug, display_order: nextDisplayOrder }]);
        setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, status: 'success', error: '', warning: '', slug } : currentItem));
        success += 1;
        nextDisplayOrder += 1;
      } catch (error) {
        if (uploadedImage && !createdProductId) await removeImage(uploadedImage);
        const errorMessage = getErrorCode(error) === '23505' ? 'Já existe um produto com este endereço. Altere o nome ou autorize a duplicidade e tente novamente.' : getErrorMessage(error, 'Não foi possível cadastrar este produto.');
        setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, status: 'error', error: errorMessage } : currentItem));
        errors += 1;
      }
    }
    setProcessing(false); setResult({ success, errors });
  };

  const pendingCount = items.filter((item) => item.status !== 'success').length;
  const defaultSubcategories = subcategories.filter((subcategory) => subcategory.category_id === defaultCategory);

  return <main className="mx-auto max-w-6xl p-4 sm:p-6">
    <Link href="/admin/produtos" className="text-sm underline">← Voltar aos produtos</Link>
    <h1 className="mt-4 font-serif text-3xl text-[#302518]">Cadastro em lote</h1>
    <p className="mt-1 text-sm text-[#6e6254]">Selecione várias fotos, revise os dados e cadastre os produtos de uma vez.</p>

    <section className="mt-6 rounded-lg bg-[#f2ece3] p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-[#4c4034]">Categoria dos produtos<select value={defaultCategory} disabled={loading || processing || Boolean(loadError)} onChange={(event) => changeDefaultCategory(event.target.value)}><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="mt-1 block text-xs font-normal">Será aplicada às próximas imagens selecionadas. Na revisão, cada categoria pode ser alterada separadamente.</span></label>
        <label className="text-sm font-semibold text-[#4c4034]">Subcategoria inicial<select value={defaultSubcategory} disabled={loading || !defaultCategory || !subcategoriesReady || processing || Boolean(loadError)} onChange={(event) => setDefaultSubcategory(event.target.value)}><option value="">Sem subcategoria</option>{defaultSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select><span className="mt-1 block text-xs font-normal">Opcional. Será aplicada inicialmente aos produtos deste lote.</span></label>
        <label className="text-sm font-semibold text-[#4c4034]">Selecionar imagens<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={loading || !defaultCategory || processing || Boolean(loadError)} onChange={(event) => { chooseFiles(event.target.files); event.target.value = ''; }} /></label>
      </div>
      {loading && <p className="mt-3 text-sm text-[#6e6254]">Carregando categorias e produtos...</p>}
      {!loading && !loadError && categories.length === 0 && <p className="mt-3 text-sm text-amber-800">Cadastre ou ative uma categoria antes de criar produtos em lote.</p>}
      {!loading && !loadError && categories.length > 0 && !defaultCategory && <p className="mt-3 text-sm text-amber-800">Escolha primeiro a categoria do lote.</p>}
      {loadError && <div role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"><p>{loadError}</p><button type="button" className="mt-2 underline" onClick={() => window.location.reload()}>Recarregar página</button></div>}
      {fileWarnings.map((warning) => <p key={warning} className="mt-2 text-sm text-red-700">{warning}</p>)}
    </section>

    {items.length > 0 && <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl">Revisão ({items.length} {items.length === 1 ? 'produto' : 'produtos'})</h2><span className="text-sm">{items.filter((item) => item.status === 'success').length} já cadastrados</span></div>
      <div className="space-y-3">{items.map((item, index) => { const duplicate = duplicateReason(item, index); const itemSubcategories = subcategories.filter((subcategory) => subcategory.category_id === item.categoryId); return <article key={item.id} className={`grid gap-3 rounded-lg border p-3 lg:grid-cols-[96px_1fr_1fr_1fr_130px_auto] ${item.status === 'success' ? 'border-green-600 bg-green-50' : item.status === 'error' ? 'border-red-500 bg-red-50' : 'border-[#bfb3a3] bg-white'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a prévia usa uma URL local temporária. */}
        <img src={item.previewUrl} alt="Prévia" className="h-24 w-24 rounded object-cover" />
        <label className="text-xs font-semibold">Nome do produto<input value={item.name} disabled={processing || item.status === 'success'} onChange={(event) => updateItem(item.id, { name: event.target.value, allowDuplicate: false })} /></label>
        <label className="text-xs font-semibold">Categoria<select value={item.categoryId} disabled={processing || item.status === 'success'} onChange={(event) => updateItem(item.id, { categoryId: event.target.value, subcategoryId: '' })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Subcategoria<select value={item.subcategoryId} disabled={!subcategoriesReady || processing || item.status === 'success'} onChange={(event) => updateItem(item.id, { subcategoryId: event.target.value })}><option value="">Sem subcategoria</option>{itemSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Preço (opcional)<input value={item.price} disabled={processing || item.status === 'success'} placeholder="229,00" onChange={(event) => updateItem(item.id, { price: event.target.value })} /></label>
        <div className="flex items-start gap-2"><button type="button" title="Mover para cima" disabled={processing || index === 0 || item.status === 'success'} onClick={() => moveItem(index, -1)}>↑</button><button type="button" title="Mover para baixo" disabled={processing || index === items.length - 1 || item.status === 'success'} onClick={() => moveItem(index, 1)}>↓</button><button type="button" className="text-sm text-red-700 underline" disabled={processing || item.status === 'success'} onClick={() => removeItem(item)}>Remover</button></div>
        {(duplicate || item.error || item.warning || item.status === 'success') && <div className="lg:col-start-2 lg:col-span-5">{duplicate && <><p className="text-sm font-semibold text-amber-800">{duplicate}</p><label className="mt-1 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={item.allowDuplicate} disabled={processing} onChange={(event) => updateItem(item.id, { allowDuplicate: event.target.checked })} />Cadastrar mesmo assim, usando outro endereço</label></>}{item.error && <p className="text-sm text-red-700">Erro: {item.error}</p>}{item.warning && <p className="text-sm text-amber-800">Atenção: {item.warning}</p>}{item.status === 'success' && <p className="text-sm font-semibold text-green-700">Produto cadastrado com sucesso.</p>}</div>}
      </article>; })}</div>
    </section>}

    {processing && <div className="mt-6 rounded bg-[#e7dbca] p-4"><p className="font-semibold">Enviando {progress.current} de {progress.total}...</p><p className="text-sm">{progress.name}</p><div className="mt-2 h-2 overflow-hidden rounded bg-white"><div className="h-full bg-[#52604a] transition-all" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} /></div></div>}
    {result && <div className="mt-6 rounded border border-[#bfb3a3] bg-white p-4"><p className="font-semibold">{result.success} {result.success === 1 ? 'produto cadastrado' : 'produtos cadastrados'} com sucesso.</p><p className={result.errors ? 'text-red-700' : ''}>{result.errors} {result.errors === 1 ? 'produto com erro' : 'produtos com erro'}.</p>{result.errors > 0 && <p className="mt-1 text-sm">Corrija os itens indicados e tente novamente somente os que falharam.</p>}</div>}
    {items.length > 0 && <button type="button" disabled={processing || pendingCount === 0 || Boolean(loadError)} onClick={registerAll} className="mt-6 rounded bg-[#52604a] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{processing ? `ENVIANDO ${progress.current} DE ${progress.total}...` : pendingCount === 0 ? 'TODOS OS PRODUTOS FORAM CADASTRADOS' : `CADASTRAR ${pendingCount} ${pendingCount === 1 ? 'PRODUTO' : 'PRODUTOS'}`}</button>}
  </main>;
}
