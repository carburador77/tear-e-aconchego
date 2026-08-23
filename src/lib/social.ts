export function getInstagramUrl(value?: string | null) {
  const instagramUrl = value?.trim();
  if (!instagramUrl) return null;

  try {
    const url = new URL(instagramUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    return (url.protocol === 'https:' || url.protocol === 'http:') && hostname === 'instagram.com' ? instagramUrl : null;
  } catch {
    return null;
  }
}
