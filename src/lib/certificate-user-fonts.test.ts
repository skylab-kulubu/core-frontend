import { certificatesApi } from '@/lib/api/certificates';
import {
  loadCertificateFont,
  missingLettersText,
  missingLettersWarning,
} from '@/lib/certificate-user-fonts';
import { elementFontStack } from '@/lib/certificate-layout';

jest.mock('@/lib/api/certificates', () => ({ certificatesApi: { fontFile: jest.fn() } }));

const FONT = {
  id: 'f-1',
  ownerTeam: 'ARTLAB',
  family: 'Gotham',
  weight: 700,
  style: 'italic' as const,
  mediaId: 'm-1',
  missingTurkish: '',
  createdAt: '2026-11-25T10:00:00Z',
};

describe('certificate user fonts', () => {
  it('names the missing letters, Turkish first, and cuts a long list', () => {
    expect(missingLettersText('ğı')).toBe('ğ, ı');
    expect(missingLettersText('Qğ')).toBe('ğ, Q');
    expect(missingLettersText('abcdefghij')).toBe('a, b, c, d, e, f ve 4 harf daha');
    expect(missingLettersWarning('')).toBe('');
    expect(missingLettersWarning('ş')).toBe('Bu yazı tipinde ş yok.');
    expect(missingLettersWarning('ş', true)).toBe(
      'Bu yazı tipinde ş yok; adlarda başka yazı tipine düşebilir.',
    );
  });

  it("draws a layer in its uploaded font first, then its family's stack", () => {
    expect(elementFontStack({ fontFamily: 'Montserrat' })).toBe(
      "Montserrat, 'Liberation Sans', sans-serif",
    );
    expect(elementFontStack({ fontFamily: 'Gotham', fontMediaId: 'm-1' })).toBe(
      "'cf-m-1', 'Liberation Sans', Arial, sans-serif",
    );
  });

  it('loads the file as bytes into document.fonts under cf-<mediaId>, once', async () => {
    const faces: unknown[] = [];
    const FontFaceMock = jest.fn(function (this: Record<string, unknown>, family, source, desc) {
      Object.assign(this, { family, source, desc, load: () => Promise.resolve(this) });
    });
    Object.assign(globalThis, { FontFace: FontFaceMock });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: (face: unknown) => faces.push(face) },
    });
    const bytes = new ArrayBuffer(4);
    (certificatesApi.fontFile as jest.Mock).mockResolvedValue({
      arrayBuffer: () => Promise.resolve(bytes),
    });

    await expect(loadCertificateFont(FONT)).resolves.toBe(true);
    await expect(loadCertificateFont(FONT)).resolves.toBe(true);
    expect(certificatesApi.fontFile).toHaveBeenCalledTimes(1);
    expect(certificatesApi.fontFile).toHaveBeenCalledWith('f-1');
    expect(FontFaceMock).toHaveBeenCalledWith('cf-m-1', bytes, { weight: '700', style: 'italic' });
    expect(faces).toHaveLength(1);
  });
});
