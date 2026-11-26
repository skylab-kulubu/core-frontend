import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BackgroundTextSheet, spanFontLine } from '@/components/certificates/BackgroundTextSheet';
import {
  certificatesApi,
  type BackgroundTextSpan,
  type CertificateElement,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';

jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: { assetText: jest.fn(), convertAssetText: jest.fn() },
}));

const assetText = certificatesApi.assetText as jest.Mock;
const convert = certificatesApi.convertAssetText as jest.Mock;

const span = (
  id: string,
  text: string,
  extra: Partial<BackgroundTextSpan> = {},
): BackgroundTextSpan => ({
  id,
  text,
  sourceFont: 'Montserrat-Bold',
  font: 'Montserrat',
  fontWeight: 700,
  fontSubstituted: false,
  fontSizePt: 32,
  convertible: true,
  ...extra,
});

const SPANS = [
  span('12', 'Katılım Belgesi'),
  span('15', 'Ad Soyad', {
    sourceFont: 'BrandonGrotesque-Regular',
    font: 'Noto Sans',
    fontWeight: 400,
    fontSubstituted: true,
  }),
  span('18', 'gg.aa.yyyy', { fontSizePt: 14 }),
  span('20', 'SKY LAB', { convertible: false, reason: 'stroke', fontSizePt: 9 }),
];

const layer = (id: string, kind: CertificateElement['kind']): CertificateElement => ({
  id,
  kind,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
});

function renderSheet(
  elements: CertificateElement[] = [layer('name', 'recipientName'), layer('qr', 'verificationQr')],
) {
  const onConverted = jest.fn();
  render(
    <BackgroundTextSheet
      open
      mediaId="bg-pdf"
      page={{ width: 1123, height: 794 }}
      placement={{ fit: 'contain', x: 0.5, y: 0.5, scale: 1 }}
      elements={elements}
      onClose={jest.fn()}
      onConverted={onConverted}
    />,
  );
  return { onConverted };
}

describe('BackgroundTextSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assetText.mockResolvedValue({ spans: SPANS, truncated: false });
    convert.mockResolvedValue({
      backgroundMediaId: 'bg-yeni',
      backgroundOriginalMediaId: 'bg-pdf',
      elements: [],
      warnings: [],
    });
  });

  it('says the font each text gets', () => {
    expect(spanFontLine(SPANS[1])).toBe('BrandonGrotesque-Regular 32 → Noto Sans 400 32');
    expect(spanFontLine(span('1', 'x', { fontStyle: 'italic', fontSizePt: 12.25 }))).toBe(
      'Montserrat-Bold 12.3 → Montserrat 700 italik 12.3',
    );
  });

  it('lists the texts, the convertible ones chosen, and sends the choice', async () => {
    const user = userEvent.setup();
    const { onConverted } = renderSheet();

    const list = await screen.findByRole('list', { name: 'PDF metinleri' });
    expect(assetText).toHaveBeenCalledWith('bg-pdf');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('checkbox', { name: /Katılım Belgesi/ })).toBeChecked();
    const stroke = screen.getByRole('checkbox', { name: /SKY LAB/ });
    expect(stroke).toBeDisabled();
    expect(stroke).not.toBeChecked();
    expect(screen.getByText('Dönüşmez: kontur yazı')).toBeInTheDocument();
    expect(screen.getByText('3 seçili · en çok 98')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /gg\.aa\.yyyy/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Katılımcı adı yap' }));
    expect(
      screen.getByText('Şablondaki Katılımcı adı katmanının yerini alır.'),
    ).toBeInTheDocument();
    // The template's own name gives way to the PDF's: one more layer of room
    expect(screen.getByText('2 seçili · en çok 99')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dönüştür' }));

    await waitFor(() => expect(onConverted).toHaveBeenCalled());
    expect(convert).toHaveBeenCalledWith('bg-pdf', {
      spanIds: ['12', '15'],
      kinds: { '15': 'recipientName' },
      page: { width: 1123, height: 794 },
      placement: { fit: 'contain', x: 0.5, y: 0.5, scale: 1 },
      existingElements: 1,
    });
    expect(onConverted.mock.calls[0][0].replacedKinds).toEqual(['recipientName']);
  });

  it('turns one piece into a kind: choosing another unchooses the first', async () => {
    const user = userEvent.setup();
    assetText.mockResolvedValue({ spans: [span('15', 'Ad Soyad'), span('16', '[İsim]')] });
    renderSheet();
    await screen.findByRole('list', { name: 'PDF metinleri' });

    const [first, second] = screen.getAllByRole('checkbox', { name: 'Katılımcı adı yap' });
    await user.click(first);
    expect(first).toBeChecked();
    await user.click(second);
    expect(second).toBeChecked();
    expect(first).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Dönüştür' }));
    await waitFor(() => expect(convert).toHaveBeenCalled());
    expect(convert.mock.calls[0][1].kinds).toEqual({ '16': 'recipientName' });
  });

  it('chooses all and none', async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByRole('list', { name: 'PDF metinleri' });

    await user.click(screen.getByRole('button', { name: 'Hiçbirini' }));
    expect(screen.getByRole('button', { name: 'Dönüştür' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Etkinlik tarihi yap' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Hepsini seç' }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(3);
  });

  it('holds the conversion past the layer limit', async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: 99 }, (_, i) => layer(`text-${i}`, 'staticText'));
    renderSheet(full);
    await screen.findByRole('list', { name: 'PDF metinleri' });

    expect(screen.getByText('3 seçili · en çok 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dönüştür' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Hiçbirini' }));
    await user.click(screen.getByRole('checkbox', { name: /Katılım Belgesi/ }));
    expect(screen.getByRole('button', { name: 'Dönüştür' })).toBeEnabled();
  });

  it('says why a PDF has no text', async () => {
    assetText.mockResolvedValue({ spans: [], textMissing: 'outlines' });
    renderSheet();
    expect(
      await screen.findByText("Bu PDF'teki yazılar eğriye çevrilmiş; düzenlenemez."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dönüştür' })).toBeDisabled();
  });

  it("says core's refusal in Turkish and keeps the sheet", async () => {
    const user = userEvent.setup();
    convert.mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'background_text_strip_failed' }),
    );
    const { onConverted } = renderSheet();
    await screen.findByRole('list', { name: 'PDF metinleri' });
    await user.click(screen.getByRole('button', { name: 'Dönüştür' }));

    expect(
      await screen.findByText("Seçilen metinler PDF'ten silinemedi; PDF değişmedi."),
    ).toBeInTheDocument();
    expect(onConverted).not.toHaveBeenCalled();
  });
});
