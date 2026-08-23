'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { comparableProductName, sortProductsAlphabetically } from '@/lib/product-utils';
import { getProductNameCorrections } from '@/lib/product-name-normalization';
import { createClient } from '@/lib/supabase/client';
import type { Category, Product, Subcategory } from '@/types/catalog';

type CompletionFilter = 'all' | 'incomplete' | 'description' | 'price' | 'subcategory';
type EditableField = 'name' | 'category_id' | 'subcategory_id' | 'price' | 'description' | 'origin' | 'dimensions' | 'care';
type PendingChange = {
  name?: string;
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
type ImportMatch = 'exact' | 'duplicate' | 'not_found' | 'manual';
type ImportRow = { id: string; productName: string; description: string; matchedProductId: string; candidateIds: string[]; match: ImportMatch; note: string; ignored: boolean; error: string };
type ImportPreviewRow = ImportRow & { product?: ProductView; status: 'ready' | 'not_found' | 'conflict' | 'ignored' | 'error'; statusLabel: string };

const emptyCopyFields: CopyFields = { name: false, category_id: false, subcategory_id: false, price: false, description: false, origin: false, dimensions: false, care: false };

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
  if (field === 'name') return (value ?? '').trim();
  if (field === 'subcategory_id') return value || null;
  if (field === 'category_id') return value ?? '';
  if (field === 'price' || field === 'description') return (value ?? '').trim();
  return (value ?? '').trim() || null;
}

function originalValue(product: Product, field: EditableField) {
  if (field === 'name') return product.name.trim();
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
    name: has('name') ? change?.name ?? product.name : product.name,
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
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
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importScopeIds, setImportScopeIds] = useState<string[]>([]);
  const [allowDescriptionOverwrite, setAllowDescriptionOverwrite] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importApplying, setImportApplying] = useState(false);
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
  const subcategoryName = (id: string | null) => id ? subcategories.find((subcategory) => subcategory.id === id)?.name ?? 'Subcategoria não encontrada' : 'Sem subcategoria';
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
        else if (field === 'name') nextChange.name = value as string;
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
  const importScopeProducts = useMemo(() => views.filter((product) => importScopeIds.includes(product.id)), [importScopeIds, views]);
  const assignmentCounts = useMemo(() => importRows.reduce((counts, row) => {
    if (row.matchedProductId && !row.ignored) counts.set(row.matchedProductId, (counts.get(row.matchedProductId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()), [importRows]);
  const importPreview = useMemo<ImportPreviewRow[]>(() => importRows.map((row) => {
    const product = views.find((item) => item.id === row.matchedProductId);
    if (row.ignored) return { ...row, product, status: 'ignored', statusLabel: 'Ignorado' };
    if (!row.matchedProductId || !product) return { ...row, product, status: row.match === 'duplicate' ? 'conflict' : 'not_found', statusLabel: row.match === 'duplicate' ? 'Nome duplicado — escolha o produto' : 'Produto não encontrado' };
    if ((assignmentCounts.get(row.matchedProductId) ?? 0) > 1) return { ...row, product, status: 'conflict', statusLabel: 'Produto repetido na importação' };
    if (!row.description.trim()) return { ...row, product, status: 'conflict', statusLabel: 'Descrição vazia' };
    if (product.description?.trim() && !allowDescriptionOverwrite) return { ...row, product, status: 'conflict', statusLabel: 'Este produto já possui descrição' };
    if (row.error) return { ...row, product, status: 'error', statusLabel: 'Erro — tente novamente' };
    return { ...row, product, status: 'ready', statusLabel: 'Pronto' };
  }), [allowDescriptionOverwrite, assignmentCounts, importRows, views]);
  const importCounts = useMemo(() => importPreview.reduce((counts, row) => {
    if (row.status === 'ready' || row.status === 'error') counts.ready += 1;
    if (row.status === 'not_found') counts.notFound += 1;
    if (row.status === 'conflict') counts.conflicts += 1;
    return counts;
  }, { ready: 0, notFound: 0, conflicts: 0 }), [importPreview]);

  const selectedNames = () => selectedViews.map((product) => product.name);
  const copyDescriptionPrompt = async () => {
    const names = selectedNames();
    if (!names.length) { setMessage('Selecione pelo menos um produto.'); return; }
    const list = names.map((name) => `- ${name}`).join('\n');
    const prompt = `Crie uma descrição breve, sofisticada e coerente com produtos artesanais premium para cada produto abaixo.\n\nAs descrições serão usadas no catálogo da Tear & Aconchego.\n\nEvite textos excessivamente longos e não invente materiais, medidas ou características técnicas que não estejam informadas.\n\nProdutos:\n\n${list}\n\nRetorne exclusivamente no seguinte formato JSON:\n\n[\n  {\n    "produto": "Nome exato do produto",\n    "descricao": "Descrição do produto"\n  }\n]`;
    setMessage(await copyText(prompt) ? 'Prompt copiado.' : 'Não foi possível copiar o prompt.');
  };
  const copyOnlyNames = async () => {
    const names = selectedNames();
    if (!names.length) { setMessage('Selecione pelo menos um produto.'); return; }
    setMessage(await copyText(names.join('\n')) ? 'Nomes copiados.' : 'Não foi possível copiar os nomes.');
  };
  const openImport = () => {
    if (!selectedViews.length) { setMessage('Selecione pelo menos um produto.'); return; }
    setImportScopeIds(selectedViews.map((product) => product.id));
    setImportText(''); setImportRows([]); setImportMessage(''); setAllowDescriptionOverwrite(false); setImportOpen(true);
  };
  const validateImport = () => {
    setImportMessage('');
    try {
      const cleaned = importText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error('O conteúdo precisa ser uma lista JSON.');
      const invalidIndex = parsed.findIndex((item) => typeof item !== 'object' || item === null || Array.isArray(item) || typeof (item as Record<string, unknown>).produto !== 'string' || !(item as Record<string, unknown>).produto?.toString().trim() || typeof (item as Record<string, unknown>).descricao !== 'string' || !(item as Record<string, unknown>).descricao?.toString().trim());
      if (invalidIndex >= 0) throw new Error(`O item ${invalidIndex + 1} precisa conter “produto” e “descricao” preenchidos.`);
      const rows = parsed.map((item, index) => {
        const record = item as Record<string, string>;
        const productName = record.produto.trim();
        const description = record.descricao.trim();
        const scopeMatches = importScopeProducts.filter((product) => product.name.trim() === productName);
        const catalogMatches = views.filter((product) => product.name.trim() === productName);
        if (catalogMatches.length > 1) return { id: `${index}-${productName}`, productName, description, matchedProductId: '', candidateIds: scopeMatches.map((product) => product.id), match: 'duplicate' as const, note: 'Existem produtos com este mesmo nome. Escolha conscientemente o destino.', ignored: false, error: '' };
        if (scopeMatches.length === 1) return { id: `${index}-${productName}`, productName, description, matchedProductId: scopeMatches[0].id, candidateIds: [scopeMatches[0].id], match: 'exact' as const, note: '', ignored: false, error: '' };
        if (scopeMatches.length > 1) return { id: `${index}-${productName}`, productName, description, matchedProductId: '', candidateIds: scopeMatches.map((product) => product.id), match: 'duplicate' as const, note: '', ignored: false, error: '' };
        return { id: `${index}-${productName}`, productName, description, matchedProductId: '', candidateIds: importScopeProducts.map((product) => product.id), match: 'not_found' as const, note: catalogMatches.length ? 'O produto existe no catálogo, mas não está entre os produtos selecionados.' : '', ignored: false, error: '' };
      }).sort((first, second) => first.productName.localeCompare(second.productName, 'pt-BR', { sensitivity: 'base' }));
      setImportRows(rows);
      setImportMessage(`${rows.length} ${rows.length === 1 ? 'descrição recebida' : 'descrições recebidas'}. Revise a prévia antes de aplicar.`);
    } catch (error) {
      setImportRows([]);
      setImportMessage(error instanceof SyntaxError ? 'Não foi possível interpretar o conteúdo. Verifique se o JSON está completo.' : errorMessage(error, 'Não foi possível validar as descrições.'));
    }
  };
  const associateImportRow = (rowId: string, productId: string) => setImportRows((current) => current.map((row) => row.id === rowId ? { ...row, matchedProductId: productId, match: productId ? 'manual' : row.candidateIds.length > 1 ? 'duplicate' : 'not_found', ignored: false, error: '' } : row));
  const updateImportedDescription = (rowId: string, description: string) => setImportRows((current) => current.map((row) => row.id === rowId ? { ...row, description, error: '' } : row));
  const toggleIgnoredImport = (rowId: string) => setImportRows((current) => current.map((row) => row.id === rowId ? { ...row, ignored: !row.ignored, error: '' } : row));
  const applyImportedDescriptions = async () => {
    const ready = importPreview.filter((row) => (row.status === 'ready' || row.status === 'error') && row.product);
    if (!ready.length || importApplying) { setImportMessage('Não há descrições prontas para atualizar.'); return; }
    if (!window.confirm(`${ready.length} ${ready.length === 1 ? 'produto terá' : 'produtos terão'} suas descrições atualizadas. Deseja continuar?`)) return;
    setImportApplying(true); setImportMessage('Aplicando descrições...');
    const succeeded = new Map<string, string>();
    const failed = new Map<string, string>();
    for (const row of ready) {
      const { error } = await supabase.from('products').update({ description: row.description.trim() }).eq('id', row.matchedProductId).select('id').single();
      if (error) failed.set(row.id, error.message); else succeeded.set(row.matchedProductId, row.description.trim());
    }
    if (succeeded.size) {
      setProducts((current) => sortProductsAlphabetically(current.map((product) => succeeded.has(product.id) ? { ...product, description: succeeded.get(product.id) ?? product.description } : product)));
      setPending((current) => {
        const next = { ...current };
        succeeded.forEach((_description, productId) => {
          if (!next[productId]) return;
          const change = { ...next[productId] };
          delete change.description;
          if (Object.keys(change).length) next[productId] = change; else delete next[productId];
        });
        return next;
      });
    }
    setImportRows((current) => current.filter((row) => !succeeded.has(row.matchedProductId)).map((row) => ({ ...row, error: failed.get(row.id) ?? row.error })));
    const result = failed.size ? `${succeeded.size} ${succeeded.size === 1 ? 'descrição atualizada' : 'descrições atualizadas'} com sucesso. ${failed.size} ${failed.size === 1 ? 'apresentou erro' : 'apresentaram erro'}.` : `${succeeded.size} ${succeeded.size === 1 ? 'descrição atualizada' : 'descrições atualizadas'} com sucesso.`;
    setImportMessage(result); setMessage(result); setImportApplying(false);
    if (!failed.size) setImportOpen(false);
  };

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

  const prepareNameNormalization = () => {
    const corrections = getProductNameCorrections(products);
    if (!corrections.length) { setMessage('Não há nomes, descrições ou materiais com correções seguras pendentes.'); return; }
    if (!window.confirm(`${corrections.length} ${corrections.length === 1 ? 'produto receberá uma correção segura' : 'produtos receberão correções seguras'} de nome, descrição ou material. Slugs, URLs e todos os demais campos serão preservados. Preparar alterações?`)) return;
    corrections.forEach((correction) => stage(correction.id, correction));
    setMessage(`${corrections.length} ${corrections.length === 1 ? 'correção preparada' : 'correções preparadas'}. Revise a prévia e clique em SALVAR ALTERAÇÕES.`);
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
        if (change.name !== undefined) row.name = change.name.trim();
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

    <section className="mt-4 rounded-lg border border-[#d7cabc] bg-white p-4"><h2 className="font-serif text-xl text-[#302518]">Padronização segura de nomes</h2><p className="mt-1 max-w-3xl text-sm text-[#6e6254]">Corrige somente os padrões já revisados: Caminho de Mesa, Porta-Copo, Porta-Guardanapo, Porta-Talher, capitalização, Macramê e Náutico. URLs, slugs, imagens, preços, categorias e demais dados não são alterados.</p><button type="button" onClick={prepareNameNormalization} disabled={saving} className="mt-3 rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a] disabled:opacity-50">REVISAR E PREPARAR CORREÇÕES</button></section>

    <section className="mt-4 rounded-lg border border-[#d7cabc] bg-white p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" onClick={selectVisible} disabled={!visibleProducts.length || allVisibleSelected} className="underline disabled:opacity-50">Selecionar todos os produtos visíveis</button><button type="button" onClick={() => setSelected(new Set())} disabled={!selected.size} className="underline disabled:opacity-50">Desmarcar todos</button><strong>{selectedViews.length} {selectedViews.length === 1 ? 'produto selecionado visível' : 'produtos selecionados visíveis'}</strong>{selected.size > selectedViews.length && <span className="text-[#8a5d2d]">{selected.size - selectedViews.length} fora do filtro serão ignorados</span>}<span className="text-[#6e6254]">{visibleProducts.length} visíveis</span></div>
      <div className="mt-4 rounded bg-[#e7dbca] p-3"><h2 className="font-serif text-lg text-[#302518]">Descrições com ChatGPT</h2><p className="mt-1 text-xs text-[#6e6254]">Copie os produtos selecionados, gere as descrições externamente e importe o JSON para revisão.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyDescriptionPrompt()} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white">Copiar para gerar descrições</button><button type="button" onClick={() => void copyOnlyNames()} className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">Copiar somente nomes</button><button type="button" onClick={openImport} className="rounded border border-[#52604a] px-4 py-2 text-sm font-semibold text-[#52604a]">Importar descrições</button></div></div>
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

    {importOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="import-title"><section className="mx-auto min-h-fit w-full max-w-6xl rounded-lg bg-[#f7f2eb] p-4 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="import-title" className="font-serif text-2xl text-[#302518]">Importar descrições</h2><p className="mt-1 text-sm text-[#6e6254]">Cole abaixo o bloco de descrições recebido do ChatGPT.</p></div><button type="button" disabled={importApplying} aria-label="Fechar importação" onClick={() => setImportOpen(false)} className="text-2xl disabled:opacity-40">×</button></div>
      <label className="mt-4 block text-sm">JSON das descrições<textarea rows={10} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'[\n  {\n    "produto": "Nome exato do produto",\n    "descricao": "Descrição do produto"\n  }\n]'} className="mt-1 w-full font-mono text-sm"/></label>
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={importApplying || !importText.trim()} onClick={validateImport} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">VALIDAR DESCRIÇÕES</button><span className="text-sm text-[#6e6254]">Somente o campo descrição poderá ser atualizado.</span></div>
      {importMessage && <p role="status" className="mt-3 rounded border border-[#c6b8a8] bg-white px-4 py-3 text-sm">{importMessage}</p>}
      {importRows.length > 0 && <><section aria-label="Resumo da importação" className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Descrições recebidas: <strong>{importRows.length}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Prontas para atualizar: <strong>{importCounts.ready}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Produtos não encontrados: <strong>{importCounts.notFound}</strong></p><p className="rounded border border-[#d7cabc] bg-white px-3 py-2">Conflitos: <strong>{importCounts.conflicts}</strong></p></section>
        <label className="mt-4 flex items-center gap-2 rounded border border-[#d7cabc] bg-white p-3 text-sm"><input type="checkbox" checked={allowDescriptionOverwrite} onChange={(event) => setAllowDescriptionOverwrite(event.target.checked)}/>Permitir substituir descrições existentes</label>
        <div className="mt-4 space-y-3">{importPreview.map((row) => {
          const associationOptions = row.match === 'duplicate' ? row.candidateIds : importScopeProducts.map((product) => product.id);
          return <article key={row.id} className={`rounded border p-4 ${row.status === 'ready' ? 'border-[#8da080] bg-white' : row.status === 'ignored' ? 'border-[#d7cabc] bg-[#eee8df] opacity-70' : 'border-[#d9a1a1] bg-white'}`}><div className="grid gap-4 lg:grid-cols-[220px_1fr_1.3fr_150px]"><div>{row.product?.image_url && <img src={row.product.image_url} alt="" loading="lazy" className="mb-2 h-14 w-14 rounded object-cover"/>}<strong className="block">{row.product?.name ?? row.productName}</strong>{row.product && <p className="mt-1 text-xs text-[#6e6254]">{categoryName(row.product.category_id)} · {subcategoryName(row.product.subcategory_id)}</p>}{(row.match === 'duplicate' || row.match === 'not_found') && !row.ignored && <label className="mt-2 block text-xs">Associar ao produto<select aria-label={`Associar ${row.productName}`} value={row.matchedProductId} onChange={(event) => associateImportRow(row.id, event.target.value)} className="mt-1 w-full"><option value="">Escolha manualmente</option>{associationOptions.map((productId) => { const option = importScopeProducts.find((product) => product.id === productId); return option ? <option key={option.id} value={option.id}>{option.name} — {categoryName(option.category_id)} / {subcategoryName(option.subcategory_id)}</option> : null; })}</select></label>}{row.note && <p className="mt-2 text-xs text-[#8a5d2d]">{row.note}</p>}</div><div><strong className="text-xs uppercase text-[#6e6254]">Descrição atual</strong>{row.product?.description?.trim() ? <details className="mt-1"><summary className="cursor-pointer text-sm underline">Visualizar texto completo</summary><p className="mt-2 whitespace-pre-wrap rounded bg-[#f2ece3] p-2 text-sm">{row.product.description}</p></details> : <p className="mt-1 text-sm">Sem descrição</p>}</div><label className="text-xs font-semibold uppercase text-[#6e6254]">Nova descrição<textarea rows={5} value={row.description} disabled={row.ignored || importApplying} onChange={(event) => updateImportedDescription(row.id, event.target.value)} className="mt-1 w-full text-sm font-normal normal-case"/></label><div><span className={`block rounded px-2 py-1 text-xs font-semibold ${row.status === 'ready' ? 'bg-[#dfe8d8] text-[#405039]' : row.status === 'ignored' ? 'bg-[#ddd5ca] text-[#655c52]' : 'bg-[#f5dada] text-[#7b3333]'}`}>{row.statusLabel}</span>{row.error && <p className="mt-2 text-xs text-red-700">{row.error}</p>}<button type="button" disabled={importApplying} onClick={() => toggleIgnoredImport(row.id)} className="mt-3 text-xs underline">{row.ignored ? 'Incluir novamente' : 'Ignorar'}</button></div></div></article>;
        })}</div>
        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#d7cabc] bg-[#f7f2eb] py-4"><button type="button" disabled={importApplying} onClick={() => setImportOpen(false)} className="rounded border border-[#786e60] px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={!importCounts.ready || importApplying} onClick={() => void applyImportedDescriptions()} className="rounded bg-[#52604a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{importApplying ? 'APLICANDO...' : `APLICAR ${importCounts.ready} ${importCounts.ready === 1 ? 'DESCRIÇÃO' : 'DESCRIÇÕES'}`}</button></div></>}
    </section></div>}
  </main>;
}
