/**
 * Draws core's QR SVG on a white PNG for printing or a slide, with an optional caption (the
 * session's title) under it. Browser only: it needs an <img> and a <canvas>.
 */
export async function qrPngBlob(svg: string, caption = '', size = 1024): Promise<Blob> {
  // Firefox draws an SVG without an intrinsic size as nothing: give it one.
  const sized = svg.replace(/<svg(?![^>]*\swidth=)/, `<svg width="${size}" height="${size}"`);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  await img.decode();

  const pad = Math.round(size * 0.04);
  const band = caption ? Math.round(size * 0.14) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size + band;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, pad, pad, size - 2 * pad, size - 2 * pad);
  if (caption) {
    let fontSize = Math.round(size * 0.06);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    do {
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      fontSize -= 2;
    } while (fontSize > 12 && ctx.measureText(caption).width > size - 2 * pad);
    ctx.fillText(caption, size / 2, size + band / 2 - pad / 2, size - 2 * pad);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png failed'))), 'image/png');
  });
}

/** Saves a blob under fileName through a temporary link. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
