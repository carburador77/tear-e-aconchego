export function formatProductPrice(price: number | null, label?: string | null) {
  if (label?.trim()) return label.trim();
  if (price == null) return '';
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
