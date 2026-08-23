import type { SelectionItem } from '@/types/selection';

export const SELECTION_STORAGE_KEY = 'tear-aconchego-selection-v1';
export const MAX_SELECTION_QUANTITY = 9999;
export const MAX_SELECTION_LINES = 30;
export const MAX_STORED_SELECTION_LENGTH = 100_000;

export function selectionItemKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId ?? ''}`;
}

export function normalizeSelectionQuantity(value: unknown) {
  const quantity = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_SELECTION_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

export function parseStoredSelection(value: string | null): SelectionItem[] {
  if (!value) return [];
  if (value.length > MAX_STORED_SELECTION_LENGTH) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const validated = new Map<string, SelectionItem>();
    for (const candidate of parsed.slice(0, MAX_SELECTION_LINES * 4)) {
      if (typeof candidate !== 'object' || candidate === null) continue;
      const record = candidate as Record<string, unknown>;
      if (typeof record.productId !== 'string' || !record.productId.trim()) continue;
      if (record.variantId !== null && record.variantId !== undefined && (typeof record.variantId !== 'string' || !record.variantId.trim())) continue;
      const item: SelectionItem = {
        productId: record.productId.trim(),
        variantId: typeof record.variantId === 'string' ? record.variantId.trim() : null,
        quantity: normalizeSelectionQuantity(record.quantity),
      };
      const key = selectionItemKey(item.productId, item.variantId);
      const previous = validated.get(key);
      if (!previous && validated.size >= MAX_SELECTION_LINES) continue;
      validated.set(key, previous ? { ...previous, quantity: normalizeSelectionQuantity(previous.quantity + item.quantity) } : item);
    }
    return [...validated.values()];
  } catch {
    return [];
  }
}

export function addSelectionItem(current: SelectionItem[], productId: string, variantId: string | null = null) {
  const key = selectionItemKey(productId, variantId);
  const existing = current.find((item) => selectionItemKey(item.productId, item.variantId) === key);
  if (!existing && current.length >= MAX_SELECTION_LINES) return current;
  if (!existing) return [...current, { productId, variantId, quantity: 1 }];
  return current.map((item) => selectionItemKey(item.productId, item.variantId) === key
    ? { ...item, quantity: normalizeSelectionQuantity(item.quantity + 1) }
    : item);
}

export function changeSelectionQuantity(current: SelectionItem[], productId: string, variantId: string | null, quantity: number) {
  const key = selectionItemKey(productId, variantId);
  return current.map((item) => selectionItemKey(item.productId, item.variantId) === key
    ? { ...item, quantity: normalizeSelectionQuantity(quantity) }
    : item);
}

export function deleteSelectionItem(current: SelectionItem[], productId: string, variantId: string | null = null) {
  const key = selectionItemKey(productId, variantId);
  return current.filter((item) => selectionItemKey(item.productId, item.variantId) !== key);
}
