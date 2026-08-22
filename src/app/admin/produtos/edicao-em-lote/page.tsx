'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { comparableProductName, sortProductsAlphabetically } from '@/lib/product-utils';
import { createClient } from '@/lib/supabase/client';
import type { Category, Product, Subcategory } from '@/types/catalog';

type CompletionFilter = 'all' | 'incomplete' | 'description' | 'price' | 'subcategory';
type EditableField = 'category_id' | 'subcategory_id' | 'price' | 'description' | 'origin' | 'dimensions' | 'care';
type PendingChange = {
  category_id?: string;
  subcategory_id?: string | null;
  price?: string;
  description?: string;
  origin?: string | null;
  dimensions?: string | null;
  care?: string | null;
};
type CopyFields = Record<EditableField, boolean>;
type ProductView = Product & { priceInput: string };

const emptyCopyFields: CopyFields = { category_id: false, subcategory_id: false, price: false, description: false, origin: false, dimensions: false, care: false };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function productPriceInput(product: Product) {
  if (product.price_label?.trim()) return product.price_label.trim();
  return product.price == null ? '' : String(product.price).replace('.', ',');
}

function normalizedValue(field: EditableField, value: string | null) {
  if (field === 'subcategory_id') return value || null;
  if (field === 'category_id') return value ?? '';
  if (field === 'price' || field === 'description') return (value ?? '').trim();
  return (value ?? '').trim() || null;
}

function originalValue(product: Product, field: EditableField) {
  if (field === 'price') return productPriceInput(product);
  if (field === 'subcategory_id') return product.subcategory_id;
  if (field === 'category_id') return product.category_id;
  if (field === 'description') return (product.description ?? '').trim();
  return (product[field] ?? '').trim() || null;
}

function effectiveProduct(product: Product, change?: PendingChange): ProductView {
  const has = (field: keyof PendingChange) => Boolean(change && Object.prototype.hasOwnProperty.call(change, field));
  return {
    ...product,
    category_id: has('category_id') ? change?.category_id ?? product.category_id : product.category_id,
    subcategory_id: has('subcategory_id') ? change?.subcategory_id ?? null : product.subcategory_id,
    description: has('description') ? change?.description ?? '' : product.description,
    origin: has('origin') ? change?.origin ?? null : product.origin,
    dimensions: has('dimensions') ? change?.dimensions ?? null : product.dimensions,
    care: has('care') ? change?.care ?? null : product.care,
    priceInput: has('price') ? change?.price ?? '' : productPriceInput(product),
  };
}

function completion(product: ProductView) {
  const noDescription = !product.description?.trim();
  const noPrice = !product.priceInput.trim();
  const noSubcategory = !product.subcategory_id;
  return { noDescription, noPrice, noSubcategory, incomplete: noDescription || noPrice || noSubcategory };
}

export default function BatchEditProductsPage() {
  const [supabase] = useState(() => createClient());
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pending, setPending] = useState<Record<string, PendingChange>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [bulkSubcategory, setBulkSubcategory] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [copySource, setCopySource] = useState('');
  const [copyFields, setCopyFields] = useState<CopyFields>(emptyCopyFields);
  const [descriptionEditor, setDescriptionEditor] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [failures, setFailures] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('subcategories').select('*').order('name'),
      supabase.from('products').select('id,category_id,subcategory_id,name,slug,description,price,image_url,origin,dimensions,care,whatsapp_url,display_order,active').order('name'),
      supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle(),
    ]).then(([categoryResult, subcategoryResult, productResult, labelsResult]) => {
      if (categoryResult.error) throw categoryResult.error;
      if (subcategoryResult.error) throw subcategoryResult.error;
      if (productResult.error) throw productResult.error;
      if (labelsResult.error) throw labelsResult.error;
      if (!active) return;
      const labels = (labelsResult.data?.value ?? {}) as Record<string, string>;
      setCategories(categoryResult.data as Category[]);
      setSubcategories(sortProductsAlphabetically(subcategoryResult.data as Subcategory[]));
      setProducts(sortProductsAlphabetically((productResult.data as Product[]).map((product) => ({ ...product, price_label: labels[product.id] ?? null }))));
    }).catch((error: unknown) => { if (active) setMessage(errorMessage(error, 'Não foi possível carregar os produtos.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase]);

  const dirtyCount = Object.keys(pending).length;
  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  const views = useMemo(() => products.map((product) => effectiveProduct(product, pending[product.id])), [pending, products]);
  const counters = useMemo(() => views.reduce((result, product) => {
    const state = completion(product);
    if (state.incomplete) result.incomplete += 1;
    if (state.noDescription) result.description += 1;
    if (state.noPrice) result.price += 1;
    if (state.noSubcategory) result.subcategory += 1;
    return result;
  }, { incomplete: 0, description: 0, price: 0, subcategory: 0 }), [views]);

  const filteredSubcategories = useMemo(() => subcategories.filter((subcategory) => subcategory.category_id === categoryFilter), [categoryFilter, subcategories]);
  const visibleProducts = useMemo(() => {
    const searched = comparableProductName(search);
    return views.filter((product) => {
      if (searched && !comparableProductName(product.name).includes(searched)) return false;
      if (categoryFilter && product.category_id !== categoryFilter) return false;
      if (subcategoryFilter && product.subcategory_id !== subcategoryFilter) return false;
      const state = completion(product);
      if (completionFilter === 'incomplete' && !state.incomplete) return false;
      if (completionFilter === 'description' && !state.noDescription) return false;
      if (completionFilter === 'price' && !state.noPrice) return false;
      if (completionFilter === 'subcategory' && !state.noSubcategory) return false;
      return true;
    });
  }, [categoryFilter, completionFilter, search, subcategoryFilter, views]);

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? 'Categoria não encontrada';
  const stage = (productId: string, changes: PendingChange) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setPending((current) => {
      const nextChange: PendingChange = { ...(current[productId] ?? {}), ...changes };
      (Object.keys(nextChange) as EditableField[]).forEach((field) => {
        const value = normalizedValue(field, nextChange[field] ?? null);
        if (value === normalizedValue(field, originalValue(product, field))) delete nextChange[field];
        else if (field === 'subcategory_id') nextChange.subcategory_id = value as string | null;
        else if (field === 'category_id') nextChange.category_id = value as string;
        else if (field === 'price') nextChange.price = value as string;
        else if (field === 'description') nextChange.description = value as string;
        else nextChange[field] = value as string | null;
      });
      const next = { ...current };
      if (Object.keys(nextChange).length) next[productId] = nextChange;
      else delete next[productId];
      return next;
    });
  };

  const changeCategoryFilter = (categoryId: string) => {
    setCategoryFilter(categoryId);
    setSubcategoryFilter('');
  };

  const toggleSelected = (productId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    return next;
  });

  const selectVisible = () => setSelected(new Set(visibleProducts.map((product) => product.id)));

  const selectedViews = visibleProducts.filter((product) => selected.has(product.id));

  const applyBulkSubcategory = () => {
    if (!selectedViews.length) { setMessage('Selecione pelo menos um produto.'); return; }
    const selectedCategoryIds = new Set(selectedViews.map((product) => product.category_id));
    if (selectedCategoryIds.size !== 1) { setMessage('Os produtos selecionados pertencem a categorias diferentes. Selecione produtos de uma única categoria.'); return; }
    const subcategory = subcategories.find((item) => item.id === bulkSubcategory);
    const categoryId = selectedViews[0].category_id;
    if (!subcategory || subcategory.category_id !== categoryId) { setMessage('Escolha uma subcategoria pertencente à categoria dos produtos selecionados.'); return; }
    if (!window.confirm(`Aplicar a subcategoria “${subcategory.name}” a ${selectedViews.length} ${selectedViews.length === 1 ? 'produto' : 'produtos'}?`)) return;
    selectedViews.forEach((product) => stage(product.id, { subcategory_id: subcategory.id }));
    setMessage(`Subcategoria preparada para ${selectedViews.length} ${selectedViews.length === 1 ? 'produto' : 'produtos'}. Clique em SALVAR ALTERAÇÕES.`);
  };

  const applyBulkPrice = () => {
    const value = bulkPrice.trim();
    if (!selectedViews.length) { setMessage('Selecione pelo menos um produto.'); return; }
    if (!value) { setMessage('Informe o preço ou texto personalizado.'); return; }
    if (!window.confirm(`Aplicar o preço “${value}” a ${selectedViews.length} ${selectedViews.length === 1 ? 'produto' : 'produtos'}?`)) return;
    selectedViews.forEach((product) => stage(product.id, { price: value }));
    setMessage(`Preço preparado para ${selectedViews.length} ${selectedViews.length === 1 ? 'produto' : 'produtos'}. Clique em SALVAR ALTERAÇÕES.`);
  };

  const applyCopy = () => {
    const source = views.find((product) => product.id === copySource);
    const fields = (Object.keys(copyFields) as EditableField[]).filter((field) => copyFields[field]);
    const targets = selectedViews.filter((product) => product.id !== copySource);
    if (!source) { setMessage('Escolha o produto de origem.'); return; }
    if (!targets.length) { setMessage('Selecione pelo menos um produto de destino diferente da origem.'); return; }
    if (!fields.length) { setMessage('Escolha pelo menos um campo para copiar.'); return; }
    if (copyFields.subcategory_id && !copyFields.category_id && targets.some((target) => target.category_id !== source.category_id)) { setMessage('Para copiar a subcategoria entre categorias diferentes, selecione também o campo Categoria.'); return; }
    if (copyFields.category_id && !copyFields.subcategory_id && targets.some((target) => target.subcategory_id && subcategories.find((item) => item.id === target.subcategory_id)?.category_id !== source.category_id)) { setMessage('Alguns produtos possuem subcategoria incompatível. Selecione também o campo Subcategoria.'); return; }
    if (!window.confirm(`Copiar ${fields.length} ${fields.length === 1 ? 'campo' : 'campos'} de “${source.name}” para ${targets.length} ${targets.length === 1 ? 'produto' : 'produtos'}?`)) return;
    targets.forEach((target) => {
      const changes: PendingChange = {};
      if (copyFields.category_id) changes.category_id = source.category_id;
      if (copyFields.subcategory_id) changes.subcategory_id = source.subcategory_id;
      if (copyFields.price) changes.price = source.priceInput;
      if (copyFields.description) changes.description = source.description ?? '';
      if (copyFields.origin) changes.origin = source.origin;
      if (copyFields.dimensions) changes.dimensions = source.dimensions;
      if (copyFields.care) changes.care = source.care;
      stage(target.id, changes);
    });
    setMessage(`Dados preparados para ${targets.length} ${targets.length === 1 ? 'produto' : 'produtos'}. Clique em SALVAR ALTERAÇÕES.`);
  };

  const savePriceLabel = async (productId: string, label: string) => {
    const { data, error: readError } = await supabase.from('site_settings').select('value').eq('key', 'product_price_labels').maybeSingle();
    if (readError) throw readError;
    const labels = { ...((data?.value ?? {}) as Record<string, string>) };
    if (label) labels[productId] = label; else delete labels[productId];
    const { error } = await supabase.from('site_settings').upsert({ key: 'product_price_labels', value: labels });
    if (error) throw error;
  };

  const saveChanges = async () => {
    const entries = Object.entries(pending);
    if (!entries.length || saving) return;
    setSaving(true); setMessage(''); setFailures([]);
    const succeeded: string[] = [];
    const failed: string[] = [];
    const updatedProducts = new Map<string, Product>();
    for (const [productId, change] of entries) {
      const product = products.find((item) => item.id === productId);
      if (!product) continue;
      try {
        const row: Record<string, string | number | null> = {};
        if (change.category_id !== undefined) row.category_id = change.category_id;
        if (change.subcategory_id !== undefined) row.subcategory_id = change.subcategory_id;
        if (change.description !== undefined) row.description = change.description.trim();
        if (change.origin !== undefined) row.origin = change.origin?.trim() || null;
        if (change.dimensions !== undefined) row.dimensions = change.dimensions?.trim() || null;
        if (change.care !== undefined) row.care = change.care?.trim() || null;
        let priceLabel: string | undefined;
        if (change.price !== undefined) {
          const enteredPrice = change.price.trim();
          const parsedPrice = enteredPrice ? Number(enteredPrice.replace(',', '.')) : null;
          priceLabel = enteredPrice && Number.isNaN(parsedPrice) ? enteredPrice : '';
          row.price = priceLabel ? null : parsedPrice;
        }
        const { data, error } = await supabase.from('products').update(row).eq('id', productId).select('*').single();
        if (error) throw error;
        if (priceLabel !== undefined) await savePriceLabel(productId, priceLabel);
        updatedProducts.set(productId, { ...(data as Product), price_label: priceLabel !== undefined ? priceLabel || null : product.price_label });
        succeeded.push(productId);
      } catch (error) {
        failed.push(`${product.name}: ${errorMessage(error, 'não foi possível atualizar')}`);
      }
    }
    if (updatedProducts.size) setProducts((current) => sortProductsAlphabetically(current.map((product) => updatedProducts.get(product.id) ?? product)));
    if (succeeded.length) setPending((current) => { const next = { ...current }; succeeded.forEach((id) => delete next[id]); return next; });
    setFailures(failed);
    setMessage(failed.length ? `${succeeded.length} ${succeeded.length === 1 ? 'produto atualizado' : 'produtos atualizados'}. ${failed.length} ${failed.length === 1 ? 'produto apresentou erro' : 'produtos apresentaram erro'}.` : `${succeeded.length} ${succeeded.length === 1 ? 'produto atualizado' : 'produtos atualizados'} com sucesso.`);
    setSaving(false);
  };

  const openDescription = (product: ProductView) => { setDescriptionEditor(product.id); setDescriptionDraft(product.description ?? ''); };
  const moveDescription = (direction: -1 | 1) => {
    const index = visibleProducts.findIndex((product) => product.id === descriptionEditor);
    if (index < 0) return;
    stage(descriptionEditor, { description: descriptionDraft });
    const next = visibleProducts[index + direction];
    if (next) { setDescriptionEditor(next.id); setDescriptionDraft(next.description ?? ''); }
  };
  const saveDescriptionAndClose = () => { stage(descriptionEditor, { description: descriptionDraft }); setDescriptionEditor(''); setMessage('Descrição guardada como alteração pendente. Clique em SALVAR ALTERAÇÕES.'); };

  const editorProduct = visibleProducts.find((product) => product.id === descriptionEditor) ?? views.find((product) => product.id === descriptionEditor);
  const editorIndex = visibleProducts.findIndex((product) => product.id === descriptionEditor);
  const bulkCategoryIds = new Set(selectedViews.map((product) => product.category_id));
  const bulkCategoryId = bulkCategoryIds.size === 1 ? selectedViews[0]?.category_id ?? '' : '';
  const bulkSubcategories = subcategories.filter((subcategory) => subcategory.category_id === bulkCategoryId && subcategory.active);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selected.has(product.id));

  if (loading) return <main className="mx-auto max-w-7xl p-6"><p>Carregando produtos...</p></main>;

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <Link href="/admin/produtos" onClick={(event) => { if (dirtyCount && !window.confirm('Existem alterações não salvas. Sair mesmo assim?')) event.preventDefault(); }} className="text-sm underline">← Voltar aos produtos</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-3xl text-[#302518]">Edição em lote</h1><p className="mt-1 text-sm text-[#6e6254]">Filtre, selecione e altere somente os campos desejados.</p></div><button type="button" disabled={!dirtyCount || saving} onClick={() => void saveChanges()} className="rounded bg-[#52604a] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'SALVANDO...' : `SALVAR ALTERAÇÕES${dirtyCount ? ` (${dirtyCount})` : ''}`}</button></div>

    <section className="mt-5 grid gap-3 rounded-lg bg-[#f2ece3] p-4 shadow-sm md:grid-cols-4">
      <label className="text-sm text-[#4c4034]">Buscar produto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite o nome" /></label>
      <label className="text-sm text-[#4c4034]">Categoria<select value={categoryFilter} onChange={(event) => changeCategoryFilter(event.target.value)}><option value="">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="text-sm text-[#4c4034]">Subcategoria<select value={subcategoryFilter} disabled={!categoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)}><option value="">Todas as subcategorias</option>{filteredSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{!subcategory.active && ' (inativa)'}</option>)}</select></label>
      <label className="text-sm text-[#4c4034]">Status de preenchimento<select value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value as CompletionFilter)}><option value="all">Todos os produtos</option><option value="incomplete">Somente produtos incompletos</option><option value="description">Sem descrição</option><option value="price">Sem preço</option><option value="subcategory">Sem subcategoria</option></select></label>
    </section>

    <section aria-label="Resumo de preenchimento" className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Produtos incompletos: <strong>{counters.incomplete}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Sem descrição: <strong>{counters.description}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Sem preço: <strong>{counters.price}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Sem subcategoria: <strong>{counters.subcategory}</strong></p></section>

    <section className="mt-4 rounded-lg border border-[#d7cabc] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" onClick={selectVisible} disabled={!visibleProducts.length || allVisibleSelected} className="underline disabled:opacity-50">Selecionar todos os produtos visíveis</button><button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size} className="underline disabled:opacity-50">Desmarcar todos</button><strong>{selectedViews.length} {selectedViews.length === 1 ? 'produto selecionado visível' : 'produtos selecionados visíveis'}</strong>{selected.size > selectedViews.length && <span className="text-[#8a5d2d]">{selected.size - selectedViews.length} fora do filtro serão ignorados</span>}<span className="text-[#6e6254]">{visibleProducts.length} visíveis</span></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded bg-[#f7f2eb] p-3"><h2 className="font-serif text-lg">Aplicar subcategoria</h2><div className="mt-2 flex flex-wrap gap-2"><select aria-label="Subcategoria para os selecionados" value={bulkSubcategory} disabled={!bulkCategoryId} onChange={(event) => setBulkSubcategory(event.target.value)} className="min-w-52 flex-1"><option value="">{bulkCategoryId ? 'Escolha a subcategoria' : 'Selecione produtos da mesma categoria'}</option>{bulkSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select><button type="button" onClick={applyBulkSubcategory} className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">APLICAR</button></div></div>
        <div className="rounded bg-[#f7f2eb] p-3"><h2 className="font-serif text-lg">Aplicar preço aos selecionados</h2><div className="mt-2 flex flex-wrap gap-2"><input value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} placeholder="Ex.: 29,90 ou Sob Consulta" className="min-w-52 flex-1"/><button type="button" onClick={applyBulkPrice} className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">APLICAR</button></div></div>
      </div>
      <details className="mt-4 rounded bg-[#f7f2eb] p-3"><summary className="cursor-pointer font-serif text-lg">Copiar dados para selecionados</summary><div className="mt-3 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_2fr_auto]"><label className="text-sm">Produto de origem<select aria-label="Produto de origem" value={copySource} onChange={(event) => setCopySource(event.target.value)}><option value="">Escolha o produto</option>{views.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><fieldset><legend className="text-sm">Escolha exatamente os campos</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{([['category_id','Categoria'],['subcategory_id','Subcategoria'],['price','Preço'],['origin','Origem / material'],['dimensions','Dimensões'],['care','Cuidados'],['description','Descrição']] as [EditableField,string][]).map(([field,label]) => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={copyFields[field]} onChange={(event) => setCopyFields((current) => ({ ...current, [field]: event.target.checked }))}/>{label}</label>)}</div></fieldset><button type="button" onClick={applyCopy} className="self-end rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">COPIAR DADOS</button></div><p className="mt-2 text-xs text-[#6e6254]">Nome, slug, imagens, variações e identificadores nunca são copiados.</p></details>
    </section>

    {message && <p role="status" className="mt-4 rounded border border-[#c6b8a8] bg-white px-4 py-3 text-sm">{message}</p>}
    {failures.length > 0 && <ul className="mt-2 list-disc rounded border border-red-300 bg-red-50 px-8 py-3 text-sm text-red-800">{failures.map((failure) => <li key={failure}>{failure}</li>)}</ul>}
    {dirtyCount > 0 && <p className="mt-3 text-sm font-semibold text-[#8a5d2d]">Existem alterações não salvas em {dirtyCount} {dirtyCount === 1 ? 'produto' : 'produtos'}.</p>}

    <div className="mt-4 overflow-x-auto rounded-lg border border-[#a99c8c] bg-white">
      <table className="min-w-[1120px] w-full border-collapse text-left text-sm"><thead className="bg-[#e7dbca]"><tr><th className="p-3"><span className="sr-only">Seleção</span></th><th className="p-3">Foto</th><th className="p-3">Produto</th><th className="p-3">Categoria</th><th className="p-3">Subcategoria</th><th className="p-3">Preço</th><th className="p-3">Descrição</th><th className="p-3">Status</th></tr></thead><tbody>{visibleProducts.map((product) => {
        const isDirty = Boolean(pending[product.id]);
        const productSubcategories = subcategories.filter((subcategory) => subcategory.category_id === product.category_id && (subcategory.active || subcategory.id === product.subcategory_id));
        return <tr key={product.id} className={`border-t border-[#ddd2c5] align-top ${isDirty ? 'bg-[#fff8df]' : ''}`}><td className="p-3"><input aria-label={`Selecionar ${product.name}`} type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelected(product.id)}/></td><td className="p-3">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" className="h-12 w-12 rounded object-cover"/> : <span className="text-xs text-[#6e6254]">Sem foto</span>}</td><td className="p-3"><strong className="block min-w-44">{product.name}</strong>{isDirty && <span className="mt-1 inline-block rounded bg-[#d9b866] px-2 py-0.5 text-[11px] font-semibold">Alterado</span>}</td><td className="p-3">{categoryName(product.category_id)}</td><td className="p-3"><select aria-label={`Subcategoria de ${product.name}`} value={product.subcategory_id ?? ''} onChange={(event) => stage(product.id, { subcategory_id: event.target.value || null })} className="min-w-44"><option value="">Sem subcategoria</option>{productSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}{!subcategory.active && ' (inativa)'}</option>)}</select></td><td className="p-3"><input aria-label={`Preço de ${product.name}`} value={product.priceInput} onChange={(event) => stage(product.id, { price: event.target.value })} placeholder="Sem preço" className="w-36"/></td><td className="max-w-72 p-3"><p className="line-clamp-2">{product.description?.trim() || 'Sem descrição'}</p><button type="button" onClick={() => openDescription(product)} className="mt-1 underline">Editar descrição</button></td><td className="p-3">{product.active ? 'Ativo' : 'Inativo'}</td></tr>;
      })}</tbody></table>
      {!visibleProducts.length && <p className="p-8 text-center text-sm text-[#6e6254]">Nenhum produto encontrado com estes filtros.</p>}
    </div>

    {editorProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="description-title"><section className="w-full max-w-2xl rounded-lg bg-[#f7f2eb] p-5 shadow-xl"><div className="flex items-start gap-4">{editorProduct.image_url && <img src={editorProduct.image_url} alt="" className="h-20 w-20 rounded object-cover"/>}<div className="min-w-0 flex-1"><h2 id="description-title" className="font-serif text-2xl text-[#302518]">{editorProduct.name}</h2><p className="text-sm text-[#6e6254]">Edite a descrição e salve tudo pelo botão principal da página.</p></div><button type="button" aria-label="Fechar edição de descrição" onClick={() => setDescriptionEditor('')} className="text-xl">×</button></div><label className="mt-4 block text-sm">Descrição<textarea autoFocus rows={8} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} className="mt-1 w-full"/></label><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button type="button" disabled={editorIndex <= 0} onClick={() => moveDescription(-1)} className="rounded border border-[#786e60] px-4 py-2 text-sm disabled:opacity-40">← Anterior</button><button type="button" disabled={editorIndex < 0 || editorIndex >= visibleProducts.length - 1} onClick={() => moveDescription(1)} className="rounded border border-[#786e60] px-4 py-2 text-sm disabled:opacity-40">Próximo →</button></div><button type="button" onClick={saveDescriptionAndClose} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white">GUARDAR DESCRIÇÃO</button></div></section></div>}
  </main>;
}
