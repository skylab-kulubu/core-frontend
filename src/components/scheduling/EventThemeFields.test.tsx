import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { EventThemeFields, type EventThemeValue } from '@/components/scheduling/EventThemeFields';
import { ProblemError } from '@/lib/api/core';
import { eventThemesApi, themesOf } from '@/lib/api/event-themes';
import { readFormBrand } from '@/lib/api/skyforms';

jest.mock('@/lib/api/event-themes', () => ({
  ...jest.requireActual('@/lib/api/event-themes'),
  eventThemesApi: { list: jest.fn() },
}));

jest.mock('@/lib/api/skyforms', () => ({
  readFormBrand: jest.fn(),
}));

const list = eventThemesApi.list as jest.Mock;
const brandOf = readFormBrand as jest.Mock;

const catalog = [
  { key: 'kurumsal', name: 'SKY LAB (Kurumsal)', accent: '#7C3AED' },
  { key: 'artlab', name: 'ARTLAB', accent: '#FF8A1F' },
];

function Harness({
  initial = {},
  formIds,
  onChange,
}: {
  initial?: EventThemeValue;
  formIds?: string[];
  onChange?: (next: EventThemeValue) => void;
}) {
  const [value, setValue] = useState<EventThemeValue>(initial);
  return (
    <EventThemeFields
      {...value}
      formIds={formIds}
      onChange={(next) => {
        onChange?.(next);
        setValue((prev) => ({ ...prev, ...next }));
      }}
    />
  );
}

beforeEach(() => {
  list.mockReset();
  brandOf.mockReset();
});

describe('themesOf', () => {
  it('reads core’s rows, the accent from preview, and drops a row without a key', () => {
    expect(
      themesOf([
        {
          key: 'artlab',
          name: 'ARTLAB',
          default: false,
          preview: { paper: '#0A1222', ink: '#EAF2FF', accent: '#FF8A1F', secondary: '#3AA0FF' },
        },
        { name: 'x' },
      ]),
    ).toEqual([{ key: 'artlab', name: 'ARTLAB', accent: '#FF8A1F' }]);
    expect(themesOf([{ key: 'artlab', preview: { accent: 'mor' } }])).toEqual([
      { key: 'artlab', name: 'artlab' },
    ]);
    expect(themesOf(null)).toEqual([]);
  });
});

describe('EventThemeFields', () => {
  it('says an older core does not have it', async () => {
    list.mockRejectedValue(new ProblemError(404, 'Not Found'));
    render(<Harness />);
    expect(await screen.findByText('Bu özellik henüz sunucuda yok.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tema')).not.toBeInTheDocument();
  });

  it('keeps the accent when the catalog fails, and reads it again', async () => {
    list
      .mockRejectedValueOnce(new ProblemError(503, 'Service Unavailable'))
      .mockResolvedValue(catalog);
    const onChange = jest.fn();
    render(<Harness initial={{ theme: 'artlab' }} onChange={onChange} />);
    expect(await screen.findByText('Temalar yüklenemedi.')).toBeInTheDocument();
    const field = screen.getByLabelText('Vurgu rengi');
    expect(field).toHaveAttribute('placeholder', 'Temanın rengi');
    await userEvent.type(field, '#3AA0FF');
    expect(onChange).toHaveBeenLastCalledWith({ ticketAccentColor: '#3AA0FF' });
    await userEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByLabelText('Tema')).toHaveValue('artlab');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('lists the catalog; Kurumsal is the empty theme', async () => {
    list.mockResolvedValue(catalog);
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);
    const select = await screen.findByLabelText('Tema');
    expect(select).toHaveValue('kurumsal');
    await userEvent.selectOptions(select, 'artlab');
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'artlab' });
    await userEvent.selectOptions(select, 'kurumsal');
    expect(onChange).toHaveBeenLastCalledWith({ theme: null });
  });

  it('adds Kurumsal when the catalog does not list it', async () => {
    list.mockResolvedValue([{ key: 'artlab', name: 'ARTLAB' }]);
    render(<Harness />);
    const select = await screen.findByLabelText('Tema');
    expect(select).toHaveValue('kurumsal');
    expect(screen.getByRole('option', { name: 'SKY LAB (Kurumsal)' })).toBeInTheDocument();
  });

  it('shows the theme colour while the accent is empty, and says a bad one', async () => {
    list.mockResolvedValue(catalog);
    const onChange = jest.fn();
    render(<Harness initial={{ theme: 'artlab' }} onChange={onChange} />);
    const field = await screen.findByLabelText('Vurgu rengi');
    expect(field).toHaveAttribute('placeholder', 'Temanın rengi (#FF8A1F)');
    expect(screen.getByText('Bilet sayfasının rengi. Boş: temanın rengi.')).toBeInTheDocument();
    await userEvent.type(field, '#12');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('#RRGGBB biçiminde yaz.')).toBeInTheDocument();
    await userEvent.type(field, '3456');
    expect(onChange).toHaveBeenLastCalledWith({ ticketAccentColor: '#123456' });
    await userEvent.click(screen.getByRole('button', { name: 'Temizle' }));
    expect(onChange).toHaveBeenLastCalledWith({ ticketAccentColor: null });
    expect(field).toHaveValue('');
  });

  it('says Kurumsal’s page takes the cover’s colour', async () => {
    list.mockResolvedValue(catalog);
    render(<Harness />);
    const field = await screen.findByLabelText('Vurgu rengi');
    expect(field).toHaveAttribute('placeholder', 'Kapağın rengi');
    expect(screen.getByText('Bilet sayfasının rengi. Boş: kapaktan alınır.')).toBeInTheDocument();
  });

  it('offers the linked form’s theme and applies it', async () => {
    list.mockResolvedValue(catalog);
    brandOf.mockResolvedValueOnce(null).mockResolvedValueOnce('artlab');
    const onChange = jest.fn();
    render(<Harness formIds={['f1', 'f2']} onChange={onChange} />);
    expect(await screen.findByText('Formun teması: ARTLAB')).toBeInTheDocument();
    expect(brandOf.mock.calls).toEqual([['f1'], ['f2']]);
    await userEvent.click(screen.getByRole('button', { name: 'Etkinliğe de uygula' }));
    expect(onChange).toHaveBeenLastCalledWith({ theme: 'artlab' });
    await waitFor(() =>
      expect(screen.queryByText('Formun teması: ARTLAB')).not.toBeInTheDocument(),
    );
  });

  it('offers nothing for a form theme the catalog does not have', async () => {
    list.mockResolvedValue(catalog);
    brandOf.mockResolvedValue('baska');
    render(<Harness formIds={['f1']} />);
    await screen.findByLabelText('Tema');
    await waitFor(() => expect(brandOf).toHaveBeenCalled());
    expect(screen.queryByText(/Formun teması/)).not.toBeInTheDocument();
  });
});
