import { svgNaturalSize, type Size } from '@/lib/certificate-placement';

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
 * for an SVG with only a viewBox.
 */
export async function backgroundNaturalSize(
  url: string,
  type?: string,
  file?: Blob,
): Promise<Size> {
  if (type?.split(';')[0].trim().toLowerCase() === SVG) {
    const text = await (file ? file.text() : fetch(url).then((response) => response.text())).catch(
      () => '',
    );
    const size = svgNaturalSize(text);
    if (size) return size;
  }
  const local = file ? URL.createObjectURL(file) : undefined;
  try {
    return await imageSize(local ?? url);
  } finally {
    if (local) URL.revokeObjectURL(local);
  }
}
