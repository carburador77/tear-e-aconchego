'use client';
/* eslint-disable @next/next/no-img-element -- As imagens vêm de URLs configuráveis do catálogo. */

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATALOG_IMAGE_ACCEPT, removeImage, uploadImage } from '@/lib/supabase/storage';
import type { Category } from '@/types/catalog';

type CategoryRow = Category & { updated_at: string };
type CategoryProductImages = {
  image_url: string | null;
  product_variants: Array<{ image_url: string | null }> | null;
};
type CategoryForm = {
  id?: string;
  updated_at?: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
  active: boolean;
};

const emptyForm = (): CategoryForm => ({
  name: '',
  slug: '',
  description: '',
  image_url: '',
  display_order: 0,
  active: true,
});

const toSlug = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function conflictError() {
  return new Error('Esta categoria foi alterada em outra aba ou sessão. Recarregue a lista e tente novamente.');
}

async function cleanupImage(url: string) {
  try {
    await removeImage(url);
    return null;
  } catch (error) {
    return errorMessage(error, 'Não foi possível limpar a imagem.');
  }
}

export default function Categories() {
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [form, setForm] = useState<CategoryForm>(() => emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('display_order');
    if (error) throw error;
    return (data ?? []) as CategoryRow[];
  }, [supabase]);

  useEffect(() => {
    let ignore = false;
    void fetchCategories()
      .then((rows) => { if (!ignore) setItems(rows); })
      .catch((error: unknown) => { if (!ignore) setMessage(errorMessage(error, 'Não foi possível carregar as categorias.')); });
    return () => { ignore = true; };
  }, [fetchCategories]);

  const refreshCategories = useCallback(async () => {
    const rows = await fetchCategories();
    setItems(rows);
  }, [fetchCategories]);

  const cancelEdit = () => {
    setForm(emptyForm());
    setFile(null);
  };

  const edit = (category: CategoryRow) => {
    setForm({
      id: category.id,
      updated_at: category.updated_at,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image_url: category.image_url ?? '',
      display_order: category.display_order,
      active: category.active,
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');

    const previousImageUrl = form.image_url || null;
    let uploadedImageUrl: string | null = null;
    let persisted = false;

    try {
      if (file) uploadedImageUrl = await uploadImage(file, 'categories');
      const imageUrl = uploadedImageUrl ?? previousImageUrl;
      const slug = form.slug || toSlug(form.name);
      if (!slug) throw new Error('O nome precisa conter pelo menos uma letra ou número.');

      const values = {
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        image_url: imageUrl,
        display_order: Number(form.display_order),
        active: form.active,
      };

      if (form.id) {
        if (!form.updated_at) throw conflictError();
        const { data, error } = await supabase
          .from('categories')
          .update(values)
          .eq('id', form.id)
          .eq('updated_at', form.updated_at)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw conflictError();
      } else {
        const { error } = await supabase.from('categories').insert(values).select('id').single();
        if (error) throw error;
      }
      persisted = true;

      const warnings: string[] = [];
      if (uploadedImageUrl && previousImageUrl && uploadedImageUrl !== previousImageUrl) {
        const cleanupError = await cleanupImage(previousImageUrl);
        if (cleanupError) warnings.push(`Não foi possível remover a imagem anterior: ${cleanupError}`);
      }

      cancelEdit();
      try {
        await refreshCategories();
      } catch (error) {
        warnings.push(errorMessage(error, 'Não foi possível atualizar a lista.'));
      }
      setMessage(warnings.length ? `Categoria salva. ${warnings.join(' ')}` : 'Categoria salva.');
    } catch (error) {
      const cleanupError = uploadedImageUrl && !persisted ? await cleanupImage(uploadedImageUrl) : null;
      const suffix = cleanupError ? ` A nova imagem também não pôde ser removida: ${cleanupError}` : '';
      setMessage(`${errorMessage(error, 'Erro ao salvar a categoria.')}${suffix}`);
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (category: CategoryRow, changes: Partial<Pick<CategoryRow, 'active' | 'display_order'>>) => {
    setMessage('');
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(changes)
        .eq('id', category.id)
        .eq('updated_at', category.updated_at)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw conflictError();
      await refreshCategories();
    } catch (error) {
      setMessage(errorMessage(error, 'Não foi possível atualizar a categoria.'));
    }
  };

  const erase = async (category: CategoryRow) => {
    if (!window.confirm(`Excluir ${category.name}? Produtos vinculados também serão removidos.`)) return;
    setMessage('');

    const { data: linkedProducts, error: linkedProductsError } = await supabase
      .from('products')
      .select('image_url,product_variants(image_url)')
      .eq('category_id', category.id);
    if (linkedProductsError) {
      setMessage(`A categoria não foi excluída porque não foi possível verificar as imagens vinculadas: ${linkedProductsError.message}`);
      return;
    }

    const imageUrls = new Set<string>();
    if (category.image_url) imageUrls.add(category.image_url);
    ((linkedProducts ?? []) as CategoryProductImages[]).forEach((product) => {
      if (product.image_url) imageUrls.add(product.image_url);
      product.product_variants?.forEach((variant) => {
        if (variant.image_url) imageUrls.add(variant.image_url);
      });
    });

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', category.id)
      .eq('updated_at', category.updated_at)
      .select('id')
      .maybeSingle();
    if (error) { setMessage(error.message); return; }
    if (!data) { setMessage(conflictError().message); return; }

    const cleanupErrors = (await Promise.all([...imageUrls].map((url) => cleanupImage(url))))
      .filter((cleanupError): cleanupError is string => Boolean(cleanupError));
    try {
      await refreshCategories();
    } catch (refreshError) {
      setMessage(`Categoria excluída. ${errorMessage(refreshError, 'Não foi possível atualizar a lista.')}`);
      return;
    }
    setMessage(cleanupErrors.length
      ? `Categoria excluída, mas ${cleanupErrors.length} imagem(ns) não puderam ser removidas do armazenamento: ${cleanupErrors[0]}`
      : 'Categoria excluída.');
  };

  return <main className="mx-auto max-w-5xl p-6">
    <Link href="/admin" className="text-sm underline">← Voltar ao painel</Link>
    <h1 className="mt-4 font-serif text-3xl">Categorias</h1>
    <form onSubmit={save} className="mt-5 grid gap-3 rounded bg-[#f2ece3] p-4 sm:grid-cols-2">
      <input required placeholder="Nome" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      <input type="number" placeholder="Ordem" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: Number(event.target.value) }))} />
      <textarea className="sm:col-span-2" placeholder="Descrição" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
      <input className="sm:col-span-2" type="file" accept={CATALOG_IMAGE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      {form.image_url && <img className="h-20 w-20 object-cover" src={form.image_url} alt="" />}
      <button disabled={saving} className="rounded bg-[#52604a] p-2 text-white disabled:opacity-60">{saving ? 'SALVANDO...' : form.id ? 'SALVAR EDIÇÃO' : 'CRIAR CATEGORIA'}</button>
      {form.id && <button type="button" disabled={saving} onClick={cancelEdit}>Cancelar</button>}
    </form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <div className="mt-6 space-y-2">{items.map((category) => <div className="flex items-center gap-3 rounded border p-3" key={category.id}>
      {category.image_url && <img className="h-12 w-12 object-cover" src={category.image_url} alt="" />}
      <span className="flex-1">{category.display_order} · {category.name} {!category.active && '(inativa)'}</span>
      <button type="button" onClick={() => void updateCategory(category, { display_order: Math.max(0, category.display_order - 1) })}>↑</button>
      <button type="button" onClick={() => void updateCategory(category, { display_order: category.display_order + 1 })}>↓</button>
      <Link className="text-sm underline" href={`/admin/categorias/${category.id}/subcategorias`}>Subcategorias</Link>
      <button type="button" onClick={() => edit(category)}>Editar</button>
      <button type="button" onClick={() => void updateCategory(category, { active: !category.active })}>{category.active ? 'Desativar' : 'Ativar'}</button>
      <button type="button" className="text-red-700" onClick={() => void erase(category)}>Excluir</button>
    </div>)}</div>
  </main>;
}
