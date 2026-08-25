'use client';
/* eslint-disable @next/next/no-img-element -- As URLs vêm do Storage configurável, sem lista fixa de domínios. */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelection } from '@/components/SelectionProvider';
import { MAX_SELECTION_QUANTITY } from '@/lib/selection';
import { isVariantImagesSchemaUnavailable, legacyVariantImage, primaryVariantImage, sortVariantImages } from '@/lib/product-images';
import { createClient } from '@/lib/supabase/client';
import { buildSelectionWhatsAppUrl } from '@/lib/whatsapp';
import type { Product, ProductVariantImage } from '@/types/catalog';
import type { SelectionWhatsAppItem } from '@/types/selection';

type CategoryJoin = { name: string; active?: boolean };

type SelectionProductRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  categories: CategoryJoin | CategoryJoin[] | null;
};

type SelectionVariantRow = {
  id: string;
  product_id: string;
  color_name: string;
  color_hex: string;
  image_url: string | null;
  images: ProductVariantImage[];
};

type CatalogState = {
  requestKey: string;
  products: SelectionProductRow[];
  variants: SelectionVariantRow[];
  error: string | null;
};

const initialCatalogState: CatalogState = {
  requestKey: '',
  products: [],
  variants: [],
  error: null,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getCategoryName(category: SelectionProductRow['categories']) {
  if (Array.isArray(category)) return category[0]?.name ?? null;
  return category?.name ?? null;
}

function LoadingSelection() {
  return <div className="py-14" role="status" aria-live="polite">
    <p className="text-center text-sm">Carregando sua seleção…</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg bg-[#e7dbca]" />)}
    </div>
  </div>;
}

export default function SelectionPageClient({ whatsappNumber, supabaseConfigured, fallbackProducts }: { whatsappNumber?: string | null; supabaseConfigured: boolean; fallbackProducts: Product[] }) {
  const { items, hydrated, updateQuantity, removeItem, clearSelection } = useSelection();
  const [supabase] = useState(() => supabaseConfigured ? createClient() : null);
  const [catalog, setCatalog] = useState<CatalogState>(initialCatalogState);
  const [retryCount, setRetryCount] = useState(0);
  const [clearConfirmationKey, setClearConfirmationKey] = useState<string | null>(null);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingClearRef = useRef(false);
  const productIdsKey = useMemo(
    () => JSON.stringify([...new Set(items.map((item) => item.productId))].sort()),
    [items],
  );
  const queryableProductIdsKey = useMemo(
    () => JSON.stringify((JSON.parse(productIdsKey) as string[]).filter((id) => UUID_PATTERN.test(id))),
    [productIdsKey],
  );
  const requestKey = `${queryableProductIdsKey}:${retryCount}`;
  const confirmingClear = clearConfirmationKey === productIdsKey;
  const fallbackCatalog = useMemo<CatalogState>(() => ({
    requestKey: 'fallback',
    products: fallbackProducts.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      image_url: product.image_url,
      categories: product.categories ? { name: product.categories.name } : null,
    })),
    variants: fallbackProducts.flatMap((product) => (product.variants ?? []).filter((variant) => variant.active).map((variant) => ({
      id: variant.id,
      product_id: variant.product_id,
      color_name: variant.color_name,
      color_hex: variant.color_hex,
      image_url: variant.image_url,
      images: variant.images,
    }))),
    error: null,
  }), [fallbackProducts]);
  const queryableProductIds = JSON.parse(queryableProductIdsKey) as string[];
  const needsRemoteCatalog = supabaseConfigured && queryableProductIds.length > 0;

  useEffect(() => {
    if (!hydrated || !supabase) return;
    const productIds = JSON.parse(queryableProductIdsKey) as string[];
    if (productIds.length === 0) return;

    let ignore = false;
    const productsRequest = supabase
      .from('products')
      .select('id,name,slug,image_url,categories!inner(name,active)')
      .in('id', productIds)
      .eq('active', true)
      .eq('categories.active', true);
    const variantsRequest = supabase
      .from('product_variants')
      .select('id,product_id,color_name,color_hex,image_url')
      .in('product_id', productIds)
      .eq('active', true);

    void Promise.all([productsRequest, variantsRequest])
      .then(async ([productsResult, variantsResult]) => {
        if (ignore) return;
        const error = productsResult.error ?? variantsResult.error;
        if (error) {
          setCatalog({ requestKey, products: [], variants: [], error: error.message });
          return;
        }

        const variantRows = (variantsResult.data ?? []) as Omit<SelectionVariantRow, 'images'>[];
        const imagesResult = variantRows.length
          ? await supabase.from('product_variant_images').select('id,product_variant_id,image_url,sort_order,is_primary,created_at').in('product_variant_id', variantRows.map((variant) => variant.id)).order('is_primary', { ascending: false }).order('sort_order').order('created_at')
          : { data: [], error: null };
        if (ignore) return;
        if (imagesResult.error && !isVariantImagesSchemaUnavailable(imagesResult.error)) {
          setCatalog({ requestKey, products: [], variants: [], error: imagesResult.error.message });
          return;
        }
        const groupedImages = ((imagesResult.data ?? []) as ProductVariantImage[]).reduce((grouped, image) => {
          grouped.set(image.product_variant_id, [...(grouped.get(image.product_variant_id) ?? []), image]);
          return grouped;
        }, new Map<string, ProductVariantImage[]>());
        const variants = variantRows.map((variant): SelectionVariantRow => ({
          ...variant,
          images: imagesResult.error ? legacyVariantImage(variant) : sortVariantImages(groupedImages.get(variant.id) ?? []),
        }));

        setCatalog({
          requestKey,
          products: (productsResult.data ?? []) as unknown as SelectionProductRow[],
          variants,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setCatalog({
          requestKey,
          products: [],
          variants: [],
          error: error instanceof Error ? error.message : 'Não foi possível carregar sua seleção.',
        });
      });

    return () => {
      ignore = true;
    };
  }, [hydrated, queryableProductIdsKey, requestKey, supabase]);

  useEffect(() => {
    if (confirmingClear) clearCancelRef.current?.focus();
    else if (wasConfirmingClearRef.current) clearTriggerRef.current?.focus();
    wasConfirmingClearRef.current = confirmingClear;
  }, [confirmingClear]);

  if (!hydrated) {
    return <section className="px-6 py-10 md:px-8" aria-labelledby="selection-title">
      <h1 id="selection-title" className="text-center font-serif text-3xl">Minha Seleção</h1>
      <LoadingSelection />
    </section>;
  }

  if (items.length === 0) {
    return <section className="px-6 py-16 text-center md:px-8" aria-labelledby="selection-title">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7dbca] font-serif text-2xl" aria-hidden="true">♡</div>
      <h1 id="selection-title" className="mt-6 font-serif text-3xl">Sua seleção está vazia</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed">Explore o catálogo e guarde aqui as peças e cores que você quer encomendar.</p>
      <Link href="/catalogo" className="mt-7 inline-flex rounded bg-[#8a785d] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2">EXPLORAR O CATÁLOGO</Link>
    </section>;
  }

  if (needsRemoteCatalog && catalog.requestKey !== requestKey) {
    return <section className="px-6 py-10 md:px-8" aria-labelledby="selection-title">
      <h1 id="selection-title" className="text-center font-serif text-3xl">Minha Seleção</h1>
      <LoadingSelection />
    </section>;
  }

  if (needsRemoteCatalog && catalog.error) {
    return <section className="px-6 py-16 text-center md:px-8" aria-labelledby="selection-title">
      <h1 id="selection-title" className="font-serif text-3xl">Minha Seleção</h1>
      <div className="mx-auto mt-8 max-w-lg rounded-lg border border-[#c9a27b] bg-[#fff8ee] p-6" role="alert">
        <h2 className="font-serif text-xl">Não foi possível carregar os produtos</h2>
        <p className="mt-2 text-sm leading-relaxed">Sua seleção continua salva neste dispositivo. Tente novamente em instantes.</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-5 rounded bg-[#52604a] px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2">TENTAR NOVAMENTE</button>
      </div>
      <Link href="/catalogo" className="mt-6 inline-flex rounded text-sm font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#52604a]">Continuar escolhendo</Link>
    </section>;
  }

  const activeCatalog = supabaseConfigured ? catalog : fallbackCatalog;
  const productsById = new Map(activeCatalog.products.map((product) => [product.id, product]));
  const variantsByProduct = activeCatalog.variants.reduce((grouped, variant) => {
    const variants = grouped.get(variant.product_id) ?? [];
    variants.push(variant);
    grouped.set(variant.product_id, variants);
    return grouped;
  }, new Map<string, SelectionVariantRow[]>());
  const resolvedItems = items.map((selectionItem) => {
    const product = productsById.get(selectionItem.productId) ?? null;
    const activeVariants = variantsByProduct.get(selectionItem.productId) ?? [];
    const variant = selectionItem.variantId
      ? activeVariants.find((candidate) => candidate.id === selectionItem.variantId) ?? null
      : null;
    let unavailableReason: string | null = null;

    if (!product) unavailableReason = 'Este produto não está mais disponível.';
    else if (selectionItem.variantId && !variant) unavailableReason = 'A cor escolhida não está mais disponível.';
    else if (!selectionItem.variantId && activeVariants.length > 0) unavailableReason = 'Este produto agora exige a escolha de uma cor.';

    return { selectionItem, product, variant, unavailableReason };
  });
  const whatsappItems: SelectionWhatsAppItem[] = resolvedItems.flatMap(({ selectionItem, product, variant, unavailableReason }) => (
    product && !unavailableReason
      ? [{ productName: product.name, variantName: variant?.color_name ?? null, quantity: selectionItem.quantity }]
      : []
  ));
  const whatsappUrl = whatsappItems.length > 0
    ? buildSelectionWhatsAppUrl({ number: whatsappNumber, items: whatsappItems })
    : null;
  const unavailableCount = resolvedItems.length - whatsappItems.length;
  return <section className="px-6 py-10 md:px-8 md:py-12" aria-labelledby="selection-title">
    <div className="flex flex-col gap-5 border-b border-[#d7cabc] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Peças salvas neste dispositivo</p>
        <h1 id="selection-title" className="mt-2 font-serif text-3xl md:text-4xl">Minha Seleção</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed">Revise quantidades e cores antes de solicitar sua composição pelo WhatsApp.</p>
      </div>
      {!confirmingClear
        ? <button ref={clearTriggerRef} type="button" onClick={() => setClearConfirmationKey(productIdsKey)} className="self-start rounded px-1 py-2 text-sm font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#52604a] sm:self-auto" aria-controls="clear-selection-confirmation">Limpar seleção</button>
        : <div id="clear-selection-confirmation" className="rounded-lg border border-[#c9a27b] bg-[#fff8ee] p-4 text-sm" role="alert" aria-labelledby="clear-selection-question">
          <p id="clear-selection-question" className="font-semibold">Deseja remover todos os itens da sua seleção?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { clearSelection(); setClearConfirmationKey(null); }} className="rounded bg-[#52604a] px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2">Sim, limpar</button>
            <button ref={clearCancelRef} type="button" onClick={() => setClearConfirmationKey(null)} className="rounded border border-[#8d8173] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#52604a]">Cancelar</button>
          </div>
        </div>}
    </div>

    {unavailableCount > 0 && <div className="mt-6 rounded-lg border border-[#c9a27b] bg-[#fff8ee] p-4" role="status">
      <p className="text-sm leading-relaxed"><strong>{unavailableCount === 1 ? 'Um item precisa de atenção.' : `${unavailableCount} itens precisam de atenção.`}</strong> Itens indisponíveis não serão incluídos na mensagem do WhatsApp.</p>
    </div>}

    <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className="space-y-4" aria-label="Itens da sua seleção">
        {resolvedItems.map(({ selectionItem, product, variant, unavailableReason }) => {
          const itemKey = `${selectionItem.productId}::${selectionItem.variantId ?? ''}`;
          const productName = product?.name ?? 'Produto indisponível';
          const imageUrl = primaryVariantImage(variant ?? undefined)?.image_url ?? product?.image_url ?? null;
          const categoryName = product ? getCategoryName(product.categories) : null;
          return <li key={itemKey}>
            <article className={`grid gap-4 rounded-lg border bg-[#fffdf9] p-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:p-5 ${unavailableReason ? 'border-[#c9a27b]' : 'border-[#d7cabc]'}`}>
              <div className="aspect-square overflow-hidden rounded bg-[#eee5d8]">
                {imageUrl
                  ? <img src={imageUrl} alt={variant ? `${productName} na cor ${variant.color_name}` : productName} width={240} height={240} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  : <div className="grid h-full min-h-28 place-items-center px-3 text-center text-xs" aria-label="Produto sem imagem">Sem imagem</div>}
              </div>
              <div className="min-w-0">
                {categoryName && <p className="text-[10px] font-semibold uppercase tracking-wider">{categoryName}</p>}
                {product
                  ? <h2 className="mt-1 font-serif text-xl"><Link href={`/produto/${product.slug}`} className="rounded underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#52604a]">{product.name}</Link></h2>
                  : <h2 className="mt-1 font-serif text-xl">{productName}</h2>}
                {variant && <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-[#8d8173]" style={{ backgroundColor: variant.color_hex }} aria-hidden="true" />
                  <span>Cor: <strong>{variant.color_name}</strong></span>
                </div>}
                {unavailableReason && <div className="mt-3 rounded bg-[#f7eadb] px-3 py-2 text-sm" role="status">
                  <p><strong>Item indisponível.</strong> {unavailableReason}</p>
                  {product && <Link href={`/produto/${product.slug}`} className="mt-2 inline-flex rounded font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#52604a]">Ver produto e escolher novamente</Link>}
                </div>}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center" role="group" aria-label={`Quantidade de ${productName}`}>
                    <button type="button" aria-label={`Diminuir quantidade de ${productName}`} disabled={selectionItem.quantity <= 1} onClick={() => updateQuantity(selectionItem.productId, selectionItem.variantId, selectionItem.quantity - 1)} className="grid h-10 w-10 place-items-center rounded-l border border-[#bfb3a3] text-xl disabled:cursor-not-allowed disabled:opacity-40 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#52604a]">−</button>
                    <span className="grid h-10 min-w-12 place-items-center border-y border-[#bfb3a3] bg-white px-2 text-sm font-semibold" aria-live="polite">{selectionItem.quantity}</span>
                    <button type="button" aria-label={`Aumentar quantidade de ${productName}`} disabled={selectionItem.quantity >= MAX_SELECTION_QUANTITY} onClick={() => updateQuantity(selectionItem.productId, selectionItem.variantId, selectionItem.quantity + 1)} className="grid h-10 w-10 place-items-center rounded-r border border-[#bfb3a3] text-xl disabled:cursor-not-allowed disabled:opacity-40 focus:z-10 focus:outline-none focus:ring-2 focus:ring-[#52604a]">+</button>
                  </div>
                  <button type="button" onClick={() => removeItem(selectionItem.productId, selectionItem.variantId)} className="rounded px-1 py-2 text-sm font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#52604a]" aria-label={`Remover ${productName} da seleção`}>Remover</button>
                </div>
              </div>
            </article>
          </li>;
        })}
      </ul>

      <aside className="rounded-lg border border-[#d7cabc] bg-[#e7dbca] p-5 lg:sticky lg:top-6" aria-labelledby="selection-summary-title">
        <h2 id="selection-summary-title" className="font-serif text-2xl">Resumo</h2>
        <dl className="mt-4 space-y-3 border-b border-[#c6b8a8] pb-4 text-sm">
          <div className="flex justify-between gap-4"><dt>Itens selecionados</dt><dd className="font-semibold">{items.length}</dd></div>
          <div className="flex justify-between gap-4"><dt>Prontos para enviar</dt><dd className="font-semibold">{whatsappItems.length}</dd></div>
        </dl>
        {whatsappUrl
          ? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center rounded bg-[#8a785d] px-4 py-3 text-center text-xs font-bold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2">SOLICITAR SELEÇÃO PELO WHATSAPP</a>
          : <div className="mt-5">
            <button type="button" disabled className="w-full cursor-not-allowed rounded bg-[#8a785d] px-4 py-3 text-xs font-bold text-white opacity-50" aria-describedby="whatsapp-disabled-help">SOLICITAR SELEÇÃO PELO WHATSAPP</button>
            <p id="whatsapp-disabled-help" className="mt-2 text-xs leading-relaxed">Escolha novamente os itens indisponíveis ou remova-os para continuar.</p>
          </div>}
        <Link href="/catalogo" className="mt-3 flex w-full items-center justify-center rounded border border-[#52604a] px-4 py-3 text-center text-xs font-bold text-[#52604a] transition hover:bg-[#52604a] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#52604a] focus:ring-offset-2">CONTINUAR ESCOLHENDO</Link>
        <p className="mt-4 text-xs leading-relaxed">O envio abre uma conversa com a loja. Você poderá revisar a mensagem antes de enviá-la.</p>
      </aside>
    </div>
  </section>;
}
