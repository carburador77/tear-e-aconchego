'use client';

import Link from 'next/link';
import { FormEvent, use, useEffect, useMemo, useState } from 'react';
import { makeProductSlug, sortProductsAlphabetically } from '@/lib/product-utils';
import { createClient } from '@/lib/supabase/client';
import type { Category, Subcategory } from '@/types/catalog';

type SubcategoryForm = { id?: string; updated_at?: string; name: string; slug: string; active: boolean };
const emptyForm: SubcategoryForm = { name: '', slug: '', active: true };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export default function SubcategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: categoryId } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<Subcategory[]>([]);
  const [form, setForm] = useState<SubcategoryForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [categoryResult, subcategoryResult] = await Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name'),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (subcategoryResult.error) throw subcategoryResult.error;
    setCategory(categoryResult.data as Category);
    setItems(sortProductsAlphabetically((subcategoryResult.data ?? []) as Subcategory[]));
  };

  useEffect(() => {
    void Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name'),
    ]).then(([categoryResult, subcategoryResult]) => {
      if (categoryResult.error) throw categoryResult.error;
      if (subcategoryResult.error) throw subcategoryResult.error;
      setCategory(categoryResult.data as Category);
      setItems(sortProductsAlphabetically((subcategoryResult.data ?? []) as Subcategory[]));
    }).catch((error: unknown) => setMessage(errorMessage(error, 'Não foi possível carregar as subcategorias.')));
  }, [categoryId, supabase]);

  const cancelEdit = () => { setForm(emptyForm); setMessage(''); };
  const edit = (subcategory: Subcategory) => {
    setForm({ id: subcategory.id, updated_at: subcategory.updated_at, name: subcategory.name, slug: subcategory.slug, active: subcategory.active });
    setMessage(`Editando: ${subcategory.name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage('');
    try {
      const values = { category_id: categoryId, name: form.name.trim(), slug: form.slug || makeProductSlug(form.name), active: form.active };
      if (!values.slug) throw new Error('O nome precisa conter pelo menos uma letra ou número.');
      let result;
      if (form.id) {
        let query = supabase.from('subcategories').update(values).eq('id', form.id);
        if (form.updated_at) query = query.eq('updated_at', form.updated_at);
        result = await query.select('id').maybeSingle();
        if (!result.error && !result.data) throw new Error('Esta subcategoria foi alterada em outra aba. Recarregue a página antes de salvar novamente.');
      } else {
        result = await supabase.from('subcategories').insert(values);
      }
      if (result.error) throw result.error;
      setForm(emptyForm);
      setMessage('Subcategoria salva com sucesso.');
      await load();
    } catch (error) { setMessage(errorMessage(error, 'Não foi possível salvar a subcategoria.')); }
    finally { setSaving(false); }
  };

  const toggle = async (subcategory: Subcategory) => {
    let query = supabase.from('subcategories').update({ active: !subcategory.active }).eq('id', subcategory.id);
    if (subcategory.updated_at) query = query.eq('updated_at', subcategory.updated_at);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) { setMessage(error.message); return; }
    if (!data) { setMessage('Esta subcategoria foi alterada em outra aba. Recarregue a página antes de tentar novamente.'); return; }
    setMessage(subcategory.active ? 'Subcategoria desativada.' : 'Subcategoria ativada.');
    await load();
  };

  const remove = async (subcategory: Subcategory) => {
    const { count, error: countError } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('subcategory_id', subcategory.id);
    if (countError) { setMessage(countError.message); return; }
    const explanation = count ? ` Ela possui ${count} ${count === 1 ? 'produto vinculado' : 'produtos vinculados'}; os produtos ficarão sem subcategoria.` : '';
    if (!window.confirm(`Excluir a subcategoria “${subcategory.name}”?${explanation}`)) return;
    let deleteQuery = supabase.from('subcategories').delete().eq('id', subcategory.id);
    if (subcategory.updated_at) deleteQuery = deleteQuery.eq('updated_at', subcategory.updated_at);
    const { data, error } = await deleteQuery.select('id').maybeSingle();
    if (error) { setMessage(error.message); return; }
    if (!data) { setMessage('Esta subcategoria foi alterada ou removida em outra aba. Recarregue a página.'); return; }
    if (form.id === subcategory.id) setForm(emptyForm);
    setMessage('Subcategoria excluída. Nenhum produto foi excluído.');
    await load();
  };

  return <main className="mx-auto max-w-4xl p-4 sm:p-6">
    <Link href="/admin/categorias" className="text-sm underline">← Voltar às categorias</Link>
    <h1 className="mt-4 font-serif text-3xl text-[#302518]">Subcategorias</h1>
    <p className="mt-1 text-sm text-[#6e6254]">Categoria: <strong>{category?.name ?? 'Carregando...'}</strong></p>
    <form onSubmit={save} className="mt-5 grid gap-3 rounded-lg bg-[#f2ece3] p-4 shadow-sm sm:grid-cols-2">
      <label className="text-sm text-[#4c4034]">Nome da subcategoria<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#4c4034]"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Subcategoria ativa</label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={saving} className="rounded bg-[#52604a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'SALVANDO...' : form.id ? 'SALVAR EDIÇÃO' : 'CRIAR SUBCATEGORIA'}</button>{form.id && <button type="button" onClick={cancelEdit} className="rounded border border-[#786e60] px-4 py-2 text-sm">Cancelar</button>}</div>
    </form>
    {message && <p role="status" className="mt-3 text-sm text-[#4c4034]">{message}</p>}
    <section className="mt-7 space-y-2">{items.map((subcategory) => <article key={subcategory.id} className="flex flex-wrap items-center gap-3 rounded border border-[#a99c8c] bg-white p-3"><span className="min-w-0 flex-1"><strong>{subcategory.name}</strong><small className="ml-2 text-[#6e6254]">{category?.name}{!subcategory.active && ' · inativa'}</small></span><button type="button" onClick={() => edit(subcategory)} className="text-sm underline">Editar</button><button type="button" onClick={() => void toggle(subcategory)} className="text-sm underline">{subcategory.active ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => void remove(subcategory)} className="text-sm text-red-700 underline">Excluir</button></article>)}</section>
  </main>;
}
