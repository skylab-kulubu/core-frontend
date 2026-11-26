import type { CertificateElementKind } from '@/lib/api/certificates';

/** What each layer of a certificate is called in the editor. */
export const ELEMENT_LABELS: Record<CertificateElementKind, string> = {
  staticText: 'Sabit metin',
  recipientName: 'Katılımcı adı',
  eventName: 'Etkinlik adı',
  eventDates: 'Etkinlik tarihi',
  issueDate: 'Verilme tarihi',
  ownerTeam: 'Sahip ekip',
  serial: 'Sertifika kodu',
  verificationQr: 'Doğrulama QR',
  image: 'Görsel',
  shape: 'Şekil',
};

/** The sample a layer shows until a real certificate fills it. */
export const SAMPLE: Record<CertificateElementKind, string> = {
  staticText: 'Metin',
  recipientName: 'Ada Lovelace',
  eventName: 'SKY LAB Etkinliği',
  eventDates: '19.09.2026',
  issueDate: '21.09.2026',
  ownerTeam: 'SKY LAB',
  serial: 'A1B2C3D4E5F6',
  verificationQr: '',
  image: '',
  shape: '',
};

/**
 * The fonts core renders certificates with, grouped as the editor offers them. Montserrat to
 * Dancing Script are core's catalog fonts: the renderer lacks them, so core embeds the files in
 * the page and the panel serves the same files (certificate-fonts.css).
 */
export const FONT_GROUPS = [
  {
    label: 'Sans serif',
    fonts: [
      ['Arial', "'Liberation Sans', Arial, sans-serif"],
      ['Helvetica', "'Liberation Sans', Helvetica, sans-serif"],
      ['Carlito', "Carlito, 'Liberation Sans', sans-serif"],
      ['Noto Sans', "'Noto Sans', 'DejaVu Sans', sans-serif"],
      ['Noto Sans Display', "'Noto Sans Display', 'Noto Sans', sans-serif"],
      ['DejaVu Sans', "'DejaVu Sans', 'Liberation Sans', sans-serif"],
      ['DejaVu Sans Condensed', "'DejaVu Sans Condensed', 'DejaVu Sans', sans-serif"],
      ['Liberation Sans', "'Liberation Sans', Arial, sans-serif"],
      ['Montserrat', "Montserrat, 'Liberation Sans', sans-serif"],
      ['Poppins', "Poppins, 'Liberation Sans', sans-serif"],
      ['Open Sans', "'Open Sans', 'Liberation Sans', sans-serif"],
      ['Roboto', "Roboto, 'Liberation Sans', sans-serif"],
      ['Inter', "Inter, 'Liberation Sans', sans-serif"],
      ['Raleway', "Raleway, 'Liberation Sans', sans-serif"],
    ],
  },
  {
    label: 'Serif',
    fonts: [
      ['Georgia', "'Liberation Serif', Georgia, serif"],
      ['Times New Roman', "'Liberation Serif', 'Times New Roman', serif"],
      ['Caladea', "Caladea, 'Liberation Serif', serif"],
      ['Noto Serif', "'Noto Serif', 'DejaVu Serif', serif"],
      ['Noto Serif Display', "'Noto Serif Display', 'Noto Serif', serif"],
      ['DejaVu Serif', "'DejaVu Serif', 'Liberation Serif', serif"],
      ['DejaVu Serif Condensed', "'DejaVu Serif Condensed', 'DejaVu Serif', serif"],
      ['Liberation Serif', "'Liberation Serif', 'Times New Roman', serif"],
      ['Playfair Display', "'Playfair Display', 'Liberation Serif', serif"],
      ['Merriweather', "Merriweather, 'Liberation Serif', serif"],
    ],
  },
  {
    label: 'El yazısı',
    fonts: [
      ['Great Vibes', "'Great Vibes', 'Liberation Serif', cursive"],
      ['Dancing Script', "'Dancing Script', 'Liberation Serif', cursive"],
    ],
  },
  {
    label: 'Monospace',
    fonts: [
      ['Courier New', "'Liberation Mono', 'Courier New', monospace"],
      ['DejaVu Sans Mono', "'DejaVu Sans Mono', 'Liberation Mono', monospace"],
      ['Liberation Mono', "'Liberation Mono', 'Courier New', monospace"],
    ],
  },
] as const;

/** The CSS font stack that draws like core's renderer. */
export function certificateFontStack(font?: string) {
  for (const group of FONT_GROUPS) {
    const match = group.fonts.find(([name]) => name === font);
    if (match) return match[1];
  }
  return "'Liberation Sans', Arial, sans-serif";
}

/**
 * A layer's CSS font stack: an uploaded font first (`cf-<mediaId>`, as core's
 * page sets it, loaded by certificate-user-fonts), then its family's stack,
 * so a letter the font lacks draws in the fallback as it prints.
 */
export function elementFontStack(element: { fontFamily?: string; fontMediaId?: string }) {
  const stack = certificateFontStack(element.fontFamily);
  return element.fontMediaId ? `'cf-${element.fontMediaId}', ${stack}` : stack;
}
