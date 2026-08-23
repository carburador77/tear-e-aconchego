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
