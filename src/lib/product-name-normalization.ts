import type { Product } from '@/types/catalog';

export type ProductNameCorrection = Pick<Product, 'id'> & {
  name?: string;
  description?: string;
  origin?: string | null;
};

const exactNames: Record<string, string> = {
  'Caminho Mesa Duo': 'Caminho de Mesa Duo',
  'Caminho Mesa Magnólia': 'Caminho de Mesa Magnólia',
  'Caminho Mesa New York': 'Caminho de Mesa New York',
  'Caminho Mesa Onda': 'Caminho de Mesa Onda',
  'Caminho Mesa Wedding': 'Caminho de Mesa Wedding',
  'Colar Macrame': 'Colar Macramê',
  'Porta Talher Onda': 'Porta-Talher Onda',
  'Porta-Copos Aura': 'Porta-Copo Aura',
  'Porta-Copos Guarani': 'Porta-Copo Guarani',
  'Porta-Copos Onda': 'Porta-Copo Onda',
  'Porta-guardanapo Cora': 'Porta-Guardanapo Cora',
  'Porta-guardanapo Folha': 'Porta-Guardanapo Folha',
  'Porta-guardanapo Onda | Alça': 'Porta-Guardanapo Onda | Alça',
  'Porta-guardanapo Onda | Corrente': 'Porta-Guardanapo Onda | Corrente',
  'Porta-guardanapo Tiana': 'Porta-Guardanapo Tiana',
  'Porta-guardanapo yeshua': 'Porta-Guardanapo Yeshua',
};

function correctedName(name: string) {
  const trimmed = name.trim().replace(/\s{2,}/g, ' ');
  return exactNames[trimmed] ?? trimmed;
}

function correctedDescription(product: Product, name: string) {
  let description = product.description ?? '';
  if (!description) return description;

  const originalName = product.name.trim();
  if (originalName !== name) description = description.replaceAll(originalName, name);

  // Some descriptions name only the product type (rather than the complete
  // model name). These replacements are limited to products whose own names
  // have the corresponding unambiguous type correction.
  if (originalName.startsWith('Porta-Copos ')) description = description.replaceAll('Porta-copos', 'Porta-Copo');
  if (originalName.startsWith('Porta-guardanapo ')) description = description.replaceAll('Porta-guardanapo', 'Porta-Guardanapo');

  return description;
}

export function getProductNameCorrections(products: Product[]): ProductNameCorrection[] {
  return products.flatMap((product) => {
    const name = correctedName(product.name);
    const description = correctedDescription(product, name);
    const origin = product.origin?.replaceAll('Naútico', 'Náutico') ?? null;
    const correction: ProductNameCorrection = { id: product.id };

    if (name !== product.name) correction.name = name;
    if (description !== (product.description ?? '')) correction.description = description;
    if (origin !== product.origin) correction.origin = origin;

    return Object.keys(correction).length > 1 ? [correction] : [];
  });
}
