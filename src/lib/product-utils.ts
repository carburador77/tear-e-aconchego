const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const productNameCollator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export function sortProductsAlphabetically<T extends { name: string }>(items: T[]) {
  return [...items].sort((first, second) => productNameCollator.compare(first.name, second.name));
}

export function makeProductSlug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function productNameFromFile(fileName: string) {
  return fileName.replace(SUPPORTED_IMAGE_EXTENSIONS, '').replace(/\s+/g, ' ').trim();
}

export function isSupportedProductImage(file: Pick<File, 'name' | 'type'>) {
  return SUPPORTED_IMAGE_EXTENSIONS.test(file.name) && (!file.type || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
}

export function comparableProductName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

export function nextAvailableProductSlug(baseSlug: string, unavailable: Set<string>) {
  const base = baseSlug || 'produto';
  if (!unavailable.has(base)) return base;
  let suffix = 2;
  while (unavailable.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
