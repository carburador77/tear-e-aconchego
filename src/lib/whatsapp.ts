import type { SelectionWhatsAppItem } from '@/types/selection';

export const DEFAULT_WHATSAPP_NUMBER = '5547988116833';

export function normalizeWhatsAppNumber(value?: string | null) {
  const match = value?.match(/wa\.me\/([^?/#]+)/i);
  const number = (match?.[1] ?? value ?? '').replace(/\D/g, '');
  return number || DEFAULT_WHATSAPP_NUMBER;
}

export function isLegacyWhatsAppUrl(value?: string | null) {
  return /^https?:\/\//i.test(value?.trim() ?? '');
}

export function defaultProductWhatsAppMessage(productName: string) {
  return `Olá! Gostaria de saber mais sobre o ${productName.trim()} e fazer uma encomenda.`;
}

export function getCustomProductWhatsAppMessage(value?: string | null) {
  const message = value?.trim();
  return message && !isLegacyWhatsAppUrl(message) ? message : null;
}

export function buildProductWhatsAppUrl({ number, productName, customMessage }: { number?: string | null; productName: string; customMessage?: string | null }) {
  const message = getCustomProductWhatsAppMessage(customMessage) ?? defaultProductWhatsAppMessage(productName);
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
}

export function buildSelectionWhatsAppMessage(items: readonly SelectionWhatsAppItem[]) {
  const lines = items.map(({ productName, variantName, quantity }) => {
    const normalizedQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
    const variant = variantName?.trim();
    return `• ${normalizedQuantity}x ${productName.trim()}${variant ? ` — Cor: ${variant}` : ''}`;
  });

  return [
    'Olá! Gostaria de solicitar uma composição com estas peças:',
    '',
    ...lines,
    '',
    'Gostaria de confirmar disponibilidade, possibilidades de personalização e valores.',
  ].join('\n');
}

export function buildSelectionWhatsAppUrl({ number, items }: { number?: string | null; items: readonly SelectionWhatsAppItem[] }) {
  const message = buildSelectionWhatsAppMessage(items);
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
}
