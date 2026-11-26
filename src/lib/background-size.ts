import { placeableSize, svgNaturalSize, type Size } from '@/lib/certificate-placement';

const SVG = 'image/svg+xml';

function imageSize(url: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve({ width: image.naturalWidth, height: image.naturalHeight })
        : reject(new Error('background size unknown'));
    image.onerror = () => reject(new Error('background unreadable'));
    image.src = url;
  });
}

/**
 * An image background's natural size, as core reads it for the placement: the
 * browser's for PNG, JPEG and WebP (EXIF orientation applied, as core does);
 * an SVG's from its width/height or viewBox, which a browser does not report
 * for an SVG with only a viewBox. Rejects a size core cannot place
 * (background_size_unknown).
 */
export async function backgroundNaturalSize(
  url: string,
  type?: string,
  file?: Blob,
): Promise<Size> {
  let size: Size | null;
  if (type?.split(';')[0].trim().toLowerCase() === SVG) {
    const text = await (
      file
        ? file.text()
        : fetch(url).then((response) => (response.ok ? response.text() : Promise.reject()))
    ).catch(() => undefined);
    // An SVG read is sized as core sizes it; only one that cannot be read falls back to the browser
    size = text !== undefined ? svgNaturalSize(text) : await browserSize(url, file);
  } else {
    size = await browserSize(url, file);
  }
  if (!placeableSize(size)) throw new Error('background size unknown');
  return size;
}

async function browserSize(url: string, file?: Blob) {
  const local = file ? URL.createObjectURL(file) : undefined;
  try {
    return await imageSize(local ?? url);
  } finally {
    if (local) URL.revokeObjectURL(local);
  }
}
