export function qrLogoQuery(opts?: { size?: number }): string {
  const params = new URLSearchParams({ logo: '1' });
  if (opts?.size != null) params.set('size', String(opts.size));
  return `?${params.toString()}`;
}
