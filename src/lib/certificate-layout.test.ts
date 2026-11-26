/**
 * @jest-environment node
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_GROUPS, certificateFontStack } from './certificate-layout';

// core-backend internal/certificate/layout.go safeFont, as written there (no space after commas)
const CORE_STACKS: [string, string][] = [
  ['Montserrat', "Montserrat,'Liberation Sans',sans-serif"],
  ['Poppins', "Poppins,'Liberation Sans',sans-serif"],
  ['Open Sans', "'Open Sans','Liberation Sans',sans-serif"],
  ['Roboto', "Roboto,'Liberation Sans',sans-serif"],
  ['Inter', "Inter,'Liberation Sans',sans-serif"],
  ['Raleway', "Raleway,'Liberation Sans',sans-serif"],
  ['Playfair Display', "'Playfair Display','Liberation Serif',serif"],
  ['Merriweather', "Merriweather,'Liberation Serif',serif"],
  ['Great Vibes', "'Great Vibes','Liberation Serif',cursive"],
  ['Dancing Script', "'Dancing Script','Liberation Serif',cursive"],
  ['Arial', "'Liberation Sans',Arial,sans-serif"],
  ['Helvetica', "'Liberation Sans',Helvetica,sans-serif"],
  ['Carlito', "Carlito,'Liberation Sans',sans-serif"],
  ['Noto Sans', "'Noto Sans','DejaVu Sans',sans-serif"],
  ['Noto Sans Display', "'Noto Sans Display','Noto Sans',sans-serif"],
  ['DejaVu Sans', "'DejaVu Sans','Liberation Sans',sans-serif"],
  ['DejaVu Sans Condensed', "'DejaVu Sans Condensed','DejaVu Sans',sans-serif"],
  ['Liberation Sans', "'Liberation Sans',Arial,sans-serif"],
  ['Georgia', "'Liberation Serif',Georgia,serif"],
  ['Times New Roman', "'Liberation Serif','Times New Roman',serif"],
  ['Caladea', "Caladea,'Liberation Serif',serif"],
  ['Noto Serif', "'Noto Serif','DejaVu Serif',serif"],
  ['Noto Serif Display', "'Noto Serif Display','Noto Serif',serif"],
  ['DejaVu Serif', "'DejaVu Serif','Liberation Serif',serif"],
  ['DejaVu Serif Condensed', "'DejaVu Serif Condensed','DejaVu Serif',serif"],
  ['Liberation Serif', "'Liberation Serif','Times New Roman',serif"],
  ['Courier New', "'Liberation Mono','Courier New',monospace"],
  ['DejaVu Sans Mono', "'DejaVu Sans Mono','Liberation Mono',monospace"],
  ['Liberation Mono', "'Liberation Mono','Courier New',monospace"],
  ['Unknown Font', "'Liberation Sans',Arial,sans-serif"],
];

// core-backend internal/certificate/fonts at f9ed035 (#453): path and the start of its SHA-256
const CORE_FONT_FILES: [string, string][] = [
  ['dancingscript/OFL.txt', '6f090277c00af966'],
  ['dancingscript/normal-400-latin-ext.woff2', '411476c2533f5352'],
  ['dancingscript/normal-400-latin.woff2', '523df895293e586e'],
  ['greatvibes/OFL.txt', '61093a21f5e63ded'],
  ['greatvibes/normal-400-latin-ext.woff2', '9db6e80f3c2cda14'],
  ['greatvibes/normal-400-latin.woff2', '0237c8316409c1e4'],
  ['inter/OFL.txt', '5b9321a4298cfeb6'],
  ['inter/italic-400-latin-ext.woff2', 'fcb8651977c3d752'],
  ['inter/italic-400-latin.woff2', '351ea309178c21f5'],
  ['inter/normal-400-700-latin-ext.woff2', 'a28eb6d3ccb534ae'],
  ['inter/normal-400-700-latin.woff2', 'c940764593d0fe5d'],
  ['merriweather/OFL.txt', '715bd349bfa6116f'],
  ['merriweather/italic-400-latin-ext.woff2', '58aaf177648e89d3'],
  ['merriweather/italic-400-latin.woff2', 'cf59331e7719702f'],
  ['merriweather/normal-400-700-latin-ext.woff2', 'f66e5c1890094c8a'],
  ['merriweather/normal-400-700-latin.woff2', 'af1be39e2ff60ede'],
  ['montserrat/OFL.txt', '8b7141c03fa4f8d4'],
  ['montserrat/italic-400-latin-ext.woff2', '6a4e3476f31de67f'],
  ['montserrat/italic-400-latin.woff2', '2ff9d27a082a0c71'],
  ['montserrat/normal-400-700-latin-ext.woff2', '920711de9ae96c18'],
  ['montserrat/normal-400-700-latin.woff2', '6438d7b8ea9c7c39'],
  ['opensans/OFL.txt', 'fbbbcfef55318de3'],
  ['opensans/italic-400-latin-ext.woff2', '439e2e9ab88cf2b3'],
  ['opensans/italic-400-latin.woff2', '920971d9555fc7f9'],
  ['opensans/normal-400-700-latin-ext.woff2', '2d4c25a2a206d165'],
  ['opensans/normal-400-700-latin.woff2', '441af0def989ebfd'],
  ['playfairdisplay/OFL.txt', '566be814f8e96e93'],
  ['playfairdisplay/italic-400-latin-ext.woff2', 'ac9c3bcc1848b07c'],
  ['playfairdisplay/italic-400-latin.woff2', 'ce3932af6f6a6c73'],
  ['playfairdisplay/normal-400-700-latin-ext.woff2', '5628567856d60d71'],
  ['playfairdisplay/normal-400-700-latin.woff2', '5d91eb5d522a0308'],
  ['poppins/OFL.txt', '6be04893d770899a'],
  ['poppins/italic-400-latin-ext.woff2', '4380c3cae8ec8ca8'],
  ['poppins/italic-400-latin.woff2', '4eaac5c96bd47f9f'],
  ['poppins/normal-400-latin-ext.woff2', '1fae5e73d2788ee1'],
  ['poppins/normal-400-latin.woff2', '3dc5d0c52428fe16'],
  ['poppins/normal-700-latin-ext.woff2', '2477683a4b120068'],
  ['poppins/normal-700-latin.woff2', '197a3cbd7290c242'],
  ['raleway/OFL.txt', 'b177e8d2c9bb144b'],
  ['raleway/italic-400-latin-ext.woff2', '0f8403227f95409b'],
  ['raleway/italic-400-latin.woff2', '06fe877278aeaedf'],
  ['raleway/normal-400-700-latin-ext.woff2', '5730d3e0b43947bf'],
  ['raleway/normal-400-700-latin.woff2', '10f1a0ef3f349790'],
  ['roboto/OFL.txt', '061402327a96aadb'],
  ['roboto/italic-400-latin-ext.woff2', '4a95e6db2c8ba08d'],
  ['roboto/italic-400-latin.woff2', 'a91c64a7a5b7ec20'],
  ['roboto/normal-400-700-latin-ext.woff2', 'cdd53dc5576a79f3'],
  ['roboto/normal-400-700-latin.woff2', '0a44e0bb6ba5c853'],
];

const FONT_DIR = join(process.cwd(), 'public/fonts/certificate');

function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe('certificate fonts', () => {
  it.each(CORE_STACKS)('draws %s with core’s stack', (font, stack) => {
    expect(certificateFontStack(font).replace(/,\s+/g, ',')).toBe(stack);
  });

  it('offers every font core knows, in the groups', () => {
    expect(FONT_GROUPS.map((group) => group.label)).toEqual([
      'Sans serif',
      'Serif',
      'El yazısı',
      'Monospace',
    ]);
    const offered = FONT_GROUPS.flatMap((group) => group.fonts.map(([font]) => font)).sort();
    const known = CORE_STACKS.map(([font]) => font)
      .filter((font) => font !== 'Unknown Font')
      .sort();
    expect(offered).toEqual(known);
  });

  it('serves the same files as core', () => {
    const served = filesUnder(FONT_DIR)
      .sort()
      .map((file) => [
        file,
        createHash('sha256')
          .update(readFileSync(join(FONT_DIR, file)))
          .digest('hex')
          .slice(0, 16),
      ]);
    expect(served).toEqual(CORE_FONT_FILES);
  });

  it('declares each font file once', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/components/certificates/certificate-fonts.css'),
      'utf8',
    );
    const urls = [...css.matchAll(/url\('\/fonts\/certificate\/([^']+)'\)/g)].map(
      (match) => match[1],
    );
    expect(urls.sort()).toEqual(
      CORE_FONT_FILES.map(([file]) => file)
        .filter((file) => file.endsWith('.woff2'))
        .sort(),
    );
  });
});
