import { createClient } from './client';
import { supabaseUrl } from './env';

export type CatalogImageFolder = 'products' | 'categories' | 'site';

export const CATALOG_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const BUCKET = 'catalog-images';
const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const MANAGED_FOLDERS = new Set<CatalogImageFolder>(['products', 'categories', 'site']);
const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', acceptedExtensions: new Set(['jpg', 'jpeg']) },
  'image/png': { extension: 'png', acceptedExtensions: new Set(['png']) },
  'image/webp': { extension: 'webp', acceptedExtensions: new Set(['webp']) },
} as const;

type AllowedImageMime = keyof typeof IMAGE_TYPES;

function fileExtension(name: string) {
  const separator = name.lastIndexOf('.');
  return separator >= 0 ? name.slice(separator + 1).toLowerCase() : '';
}

function hasImageSignature(bytes: Uint8Array, mime: AllowedImageMime) {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mime === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
  }

  return bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

async function validateImage(file: File) {
  if (file.size <= 0) throw new Error('A imagem selecionada está vazia.');
  if (file.size > CATALOG_IMAGE_MAX_BYTES) throw new Error('A imagem deve ter no máximo 5 MiB.');

  const mime = file.type.trim().toLowerCase() as AllowedImageMime;
  const imageType = IMAGE_TYPES[mime];
  if (!imageType) throw new Error('Formato não aceito. Use uma imagem JPEG, PNG ou WebP.');

  const extension = fileExtension(file.name);
  if (!imageType.acceptedExtensions.has(extension)) {
    throw new Error('A extensão do arquivo não corresponde ao formato da imagem.');
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasImageSignature(bytes, mime)) {
    throw new Error('O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP válida.');
  }

  return { mime, extension: imageType.extension };
}

function fileId() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) throw new Error('Não foi possível gerar um nome seguro para a imagem.');
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function managedStoragePath(url: string) {
  let parsedUrl: URL;
  let projectUrl: URL;
  try {
    parsedUrl = new URL(url);
    projectUrl = new URL(supabaseUrl ?? '');
  } catch {
    throw new Error('Não foi possível verificar a URL da imagem armazenada.');
  }

  if (parsedUrl.origin !== projectUrl.origin || !parsedUrl.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) return null;

  const encodedPath = parsedUrl.pathname.slice(PUBLIC_OBJECT_PREFIX.length);
  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    throw new Error('O caminho da imagem armazenada é inválido.');
  }

  const segments = path.split('/');
  if (
    segments.length < 2
    || !MANAGED_FOLDERS.has(segments[0] as CatalogImageFolder)
    || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'))
  ) {
    throw new Error('O caminho da imagem não pertence a uma pasta administrada do catálogo.');
  }

  return path;
}

export async function uploadImage(file: File, folder: CatalogImageFolder) {
  const { mime, extension } = await validateImage(file);
  const path = `${folder}/${fileId()}.${extension}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '31536000',
    contentType: mime,
  });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeImage(url?: string | null) {
  if (!url) return;
  const path = managedStoragePath(url);
  if (!path) return;

  const { error } = await createClient().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Não foi possível remover a imagem do armazenamento: ${error.message}`);
}
