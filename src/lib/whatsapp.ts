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
  const article = /^(manta|almofada|coberta|peseira|peça)\b/i.test(productName.trim()) ? 'a' : 'o';
  return `Olá! Gostaria de saber mais sobre ${article} ${productName.trim()} e fazer uma encomenda.`;
}

export function buildProductWhatsAppUrl({ number, productName, customMessage, legacyUrl }: { number?: string | null; productName: string; customMessage?: string | null; legacyUrl?: string | null }) {
  if (isLegacyWhatsAppUrl(legacyUrl)) return legacyUrl!.trim();
  const message = customMessage?.trim() || defaultProductWhatsAppMessage(productName);
  return `https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
}
