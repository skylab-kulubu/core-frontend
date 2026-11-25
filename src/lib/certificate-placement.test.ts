import type { CertificateLayout } from '@/lib/api/certificates';
import {
  fitPageToBackground,
  normalizePlacement,
  pageForBackground,
  placeBackground,
  placeableSize,
  ratioDiffers,
  resizeCertificateLayout,
  svgNaturalSize,
} from '@/lib/certificate-placement';
// The same file as core-backend internal/certificate/testdata/background-placement.json;
// when one changes, both change in the same pair of PRs.
import golden from '@/lib/__fixtures__/background-placement.json';

type GoldenCase = {
  name: string;
  page: { width: number; height: number };
  source: { width: number; height: number };
  placement: Parameters<typeof placeBackground>[4];
  want: { left: number; top: number; width: number; height: number };
};

const table = golden as { tolerance: number; cases: GoldenCase[] };

const layout = (width: number, height: number): CertificateLayout => ({
  width,
  height,
  orientation: width >= height ? 'landscape' : 'portrait',
  backgroundColor: '#ffffff',
  backgroundMediaId: 'bg',
  elements: [
    { id: 'name', kind: 'recipientName', x: 140, y: 285, width: 843, height: 64, fontSize: 48 },
    { id: 'edge', kind: 'shape', x: 0, y: 0, width: 1123, height: 794 },
  ],
});

describe('placeBackground', () => {
  it('has the golden table core tests too', () => {
    expect(table.tolerance).toBe(0.01);
    expect(table.cases.length).toBe(600);
  });

  it.each(table.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const got = placeBackground(
      c.page.width,
      c.page.height,
      c.source.width,
      c.source.height,
      c.placement,
    );
    for (const key of ['left', 'top', 'width', 'height'] as const) {
      expect(Math.abs(got[key] - c.want[key])).toBeLessThanOrEqual(table.tolerance);
    }
  });
});

describe('normalizePlacement', () => {
  it('sends scale 1 for fill and keeps the rest in range', () => {
    expect(normalizePlacement({ fit: 'fill', x: 0.5, y: 0.5, scale: 3 })).toEqual({
      fit: 'fill',
      x: 0.5,
      y: 0.5,
      scale: 1,
    });
    expect(normalizePlacement({ fit: 'contain', x: -1, y: 2, scale: 0.01 })).toEqual({
      fit: 'contain',
      x: 0,
      y: 1,
      scale: 0.1,
    });
    expect(normalizePlacement({ fit: 'none', x: Number.NaN, y: 0, scale: 40 }).scale).toBe(10);
  });
});

describe('fitting the page to the background', () => {
  it('takes an A4 PDF page at 96/72', () => {
    expect(pageForBackground({ width: (595 * 96) / 72, height: (842 * 96) / 72 })).toEqual({
      width: 793,
      height: 1123,
    });
  });

  it('scales a very large image into 4000 px with its ratio', () => {
    expect(pageForBackground({ width: 6000, height: 4000 })).toEqual({ width: 4000, height: 2667 });
    expect(pageForBackground({ width: 200, height: 150 })).toEqual({ width: 400, height: 300 });
  });

  it('cannot fit a 20:1 image', () => {
    expect(pageForBackground({ width: 4000, height: 200 })).toBeNull();
    expect(fitPageToBackground(layout(1123, 794), { width: 4000, height: 200 })).toBeNull();
  });

  it('scales the layers with the page, keeps them inside and stretches the background', () => {
    const fitted = fitPageToBackground(layout(1123, 794), { width: 1920, height: 1080 });
    expect(fitted).toMatchObject({
      width: 1920,
      height: 1080,
      orientation: 'landscape',
      backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
    });
    const [name, edge] = fitted!.elements;
    expect(name).toMatchObject({ x: 239, y: 388, width: 1441, height: 87, fontSize: 65 });
    expect(edge.x + edge.width).toBeLessThanOrEqual(1920);
    expect(edge.y + edge.height).toBeLessThanOrEqual(1080);
  });

  it('turns the page to portrait for a portrait background', () => {
    const fitted = fitPageToBackground(layout(1123, 794), { width: 842, height: 1191 });
    expect(fitted).toMatchObject({ width: 842, height: 1191, orientation: 'portrait' });
    for (const element of fitted!.elements) {
      expect(element.x + element.width).toBeLessThanOrEqual(842);
      expect(element.y + element.height).toBeLessThanOrEqual(1191);
    }
  });

  it('keeps the layers of a page that already has the size', () => {
    const page = layout(1123, 794);
    expect(fitPageToBackground(page, { width: 1123, height: 794 })?.elements).toBe(page.elements);
  });

  it('keeps the QR square around its centre, on a fitted page and on a preset', () => {
    const page = layout(1123, 794);
    page.elements.push({
      id: 'qr',
      kind: 'verificationQr',
      x: 910,
      y: 610,
      width: 130,
      height: 130,
    });
    const centre = (
      e: { x: number; y: number; width: number; height: number },
      w: number,
      h: number,
    ) => [(e.x + e.width / 2) / w, (e.y + e.height / 2) / h];
    const [cx, cy] = centre(page.elements[2], 1123, 794);
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 794, height: 1123 },
      { width: 842, height: 1191 },
    ]) {
      const qr = fitPageToBackground(page, size)!.elements[2];
      expect(qr.width).toBe(qr.height);
      expect(qr.width).toBe(Math.round(130 * Math.min(size.width / 1123, size.height / 794)));
      const [x, y] = centre(qr, size.width, size.height);
      expect(Math.abs(x - cx) * size.width).toBeLessThanOrEqual(1);
      expect(Math.abs(y - cy) * size.height).toBeLessThanOrEqual(1);
    }
    const portrait = resizeCertificateLayout(page, { width: 794, height: 1123 }).elements[2];
    expect(portrait).toMatchObject({ width: 92, height: 92 });
  });

  it('keeps a resized layer inside the page', () => {
    const resized = resizeCertificateLayout(layout(1123, 794), { width: 1056, height: 816 });
    for (const element of resized.elements) {
      expect(element.x + element.width).toBeLessThanOrEqual(1056);
      expect(element.y + element.height).toBeLessThanOrEqual(816);
    }
  });

  it('calls a ratio different above 0.5 %', () => {
    expect(ratioDiffers({ width: 1123, height: 794 }, { width: 1920, height: 1080 })).toBe(true);
    expect(ratioDiffers({ width: 1123, height: 794 }, { width: 2246, height: 1590 })).toBe(false);
  });
});

describe('svgNaturalSize (core-backend svgSize)', () => {
  it('reads width and height in px or without a unit', () => {
    expect(svgNaturalSize('<svg width="800px" height="600" viewBox="0 0 8 6"></svg>')).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('takes the size of an SVG with only a viewBox from the viewBox', () => {
    expect(
      svgNaturalSize(
        '<?xml version="1.0"?><!-- logo --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0 1600 900">',
      ),
    ).toEqual({ width: 1600, height: 900 });
  });

  it('reads px, pt, pc, mm, cm and in', () => {
    const side = (value: string) =>
      svgNaturalSize(`<svg width="${value}" height="${value}">`)?.width;
    expect(side('96px')).toBe(96);
    expect(side('72pt')).toBeCloseTo(96, 9);
    expect(side('6pc')).toBe(96);
    expect(side('25.4mm')).toBeCloseTo(96, 9);
    expect(side('2.54cm')).toBeCloseTo(96, 9);
    expect(side('1IN')).toBe(96);
  });

  it('keeps the viewBox ratio when one side is missing or in a relative unit', () => {
    expect(svgNaturalSize('<svg width="400" viewBox="0 0 1600 900">')).toEqual({
      width: 400,
      height: 225,
    });
    expect(svgNaturalSize('<svg width="100%" height="450" viewBox="0 0 1600 900">')).toEqual({
      width: 800,
      height: 450,
    });
  });

  it('takes only a CSS number glued to its unit', () => {
    // "10 cm", "0x1p4", "5." and "Inf" are no lengths: the viewBox gives the size
    for (const bad of ['10 cm', '0x1p4', '5.', 'Inf', '1e400']) {
      expect(svgNaturalSize(`<svg width="${bad}" height="${bad}" viewBox="0 0 4 2">`)).toEqual({
        width: 4,
        height: 2,
      });
    }
    expect(svgNaturalSize('<svg width=".5e1" height="+3">')).toEqual({ width: 5, height: 3 });
    expect(svgNaturalSize('<svg viewBox="0 0 0x10 5.">')).toBeNull();
  });

  it('reads only the head of a large file for the root', () => {
    const late = `<!--${'x'.repeat(70 * 1024)}--><svg width="10" height="10">`;
    expect(svgNaturalSize(late)).toBeNull();
    const started = Date.now();
    expect(svgNaturalSize(`<!--${'<!--'.repeat(200_000)}`)).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('has no size without either, or when the root is not an svg', () => {
    expect(svgNaturalSize('<svg width="50%" height="2em">')).toBeNull();
    expect(svgNaturalSize('<html><svg width="10" height="10"></svg></html>')).toBeNull();
  });
});

describe('placeableSize', () => {
  it('takes a side of 0.001 to 1e6 px, as core does', () => {
    expect(placeableSize({ width: 0.001, height: 1e6 })).toBe(true);
    expect(placeableSize({ width: 0.0009, height: 10 })).toBe(false);
    expect(placeableSize({ width: 10, height: 1e6 + 1 })).toBe(false);
    expect(placeableSize(svgNaturalSize('<svg width="0.0000001" height="10">'))).toBe(false);
    expect(placeableSize(null)).toBe(false);
  });
});
