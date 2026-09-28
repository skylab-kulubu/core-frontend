import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { EventFormSlots } from '@/components/scheduling/EventFormSlots';
import { ProblemError } from '@/lib/api/core';
import { urlsApi, type ShortUrl } from '@/lib/api/urls';
import { emptyApplySlot, type EventFormSlot } from '@/lib/event-forms';

jest.mock('@/lib/api/urls', () => {
  const actual = jest.requireActual('@/lib/api/urls') as typeof import('@/lib/api/urls');
  return {
    ...actual,
    urlsApi: { availability: jest.fn(), create: jest.fn(), update: jest.fn(), listMine: jest.fn() },
  };
});

jest.mock('@/lib/api/skyforms', () => ({
  readFormGate: jest.fn().mockResolvedValue('open'),
  setFormGate: jest.fn(),
}));

const SKYFORMS_URL = 'https://forms.yildizskylab.com/22222222-2222-4222-8222-222222222222';
const CREATE_SHORT = { name: 'Kısa link oluştur' };

const create = urlsApi.create as jest.Mock;
const update = urlsApi.update as jest.Mock;
const availability = urlsApi.availability as jest.Mock;
const listMine = urlsApi.listMine as jest.Mock;

const SKYFORMS_TAKEN =
  'Bu ad kullanılıyor. Formun kendi linki değilse etkinlik bu ada bağlanmaz; form kendi linkini korur.';

/** Core refusing a generic rename because an Event or a Form manages the link. */
const managed = () => new ProblemError(409, 'Conflict', { code: 'managed' });

function link(partial: Partial<ShortUrl>): ShortUrl {
  return {
    id: 'u-new',
    alias: 'x',
    url: 'https://apply.example.test',
    clickCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

/** Like EventEditor: it keeps the slots the component hands back. */
function Slots({
  initial,
  onChange = () => {},
}: {
  initial: EventFormSlot;
  onChange?: (slots: EventFormSlot[]) => void;
}) {
  const [slots, setSlots] = useState([initial]);
  return (
    <EventFormSlots
      slots={slots}
      eventName="SkyDays"
      ownerTeam="GECEKODU"
      startLocal="2026-05-01T09:00"
      onChange={(next) => {
        setSlots(next);
        onChange(next);
      }}
    />
  );
}

function renderSlot(initial: EventFormSlot) {
  const onChange = jest.fn();
  render(<Slots initial={initial} onChange={onChange} />);
  const lastSlot = () => (onChange.mock.lastCall?.[0] as EventFormSlot[] | undefined)?.[0];
  return { lastSlot };
}

describe('EventFormSlots short links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    availability.mockResolvedValue({ alias: 'x', available: true });
    listMine.mockResolvedValue([]);
  });

  it('suggests the alias core will be given, hyphenated for skyl.app', () => {
    renderSlot({ ...emptyApplySlot(), url: 'https://apply.example.test' });

    expect(screen.getByLabelText('Kısa adres')).toHaveAttribute(
      'placeholder',
      'gecekodu-skydays2026',
    );
  });

  it('fills a Skyforms slot’s alias and leaves its link to the Event save', async () => {
    const typist = userEvent.setup();
    renderSlot({ ...emptyApplySlot(), mode: 'skyforms', url: SKYFORMS_URL });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(await screen.findByLabelText('Kısa adres')).toHaveValue('gecekodu-skydays2026');
    expect(screen.getByRole('status')).toHaveTextContent('Kısa link etkinlik kaydedilince oluşur');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not rename a Skyforms form’s link through the generic link endpoint', async () => {
    const typist = userEvent.setup();
    update.mockRejectedValue(managed());
    const { lastSlot } = renderSlot({
      ...emptyApplySlot(),
      mode: 'skyforms',
      url: SKYFORMS_URL,
      alias: 'yeni.ad',
      urlId: 'u1',
      saved: { alias: 'gecekodu-skydays2026', url: SKYFORMS_URL },
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(await screen.findByText('Kısa link etkinlik kaydedilince oluşur')).toBeInTheDocument();
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(lastSlot()?.alias).toBe('yeni-ad');
  });

  it('says an event-managed link takes its new alias when the Event is saved', async () => {
    const typist = userEvent.setup();
    update.mockRejectedValue(managed());
    const { lastSlot } = renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply.example.test',
      alias: 'yeni.ad',
      urlId: 'u1',
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(update).toHaveBeenCalledWith('u1', {
      url: 'https://apply.example.test',
      alias: 'yeni-ad',
    });
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Kısa link etkinlik kaydedilince uygulanır'),
    ).toBeInTheDocument();
    expect(lastSlot()).toMatchObject({ alias: 'yeni-ad', urlId: 'u1' });
  });

  it('still shows any other refusal of a rename', async () => {
    const typist = userEvent.setup();
    update.mockRejectedValue(new ProblemError(409, 'Conflict', { code: 'alias_taken' }));
    renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply.example.test',
      alias: 'dolu',
      urlId: 'u1',
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(await screen.findByText('Conflict')).toBeInTheDocument();
  });

  it('asks once for the link an external slot was loaded with, and says it exists', async () => {
    const typist = userEvent.setup();
    create.mockRejectedValue(new ProblemError(409, 'Conflict'));
    renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply.example.test',
      alias: 'skydays2026',
      saved: { alias: 'skydays2026', url: 'https://apply.example.test' },
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(await screen.findByText('Kısa link zaten var')).toBeInTheDocument();
    expect(create.mock.calls).toEqual([
      [{ url: 'https://apply.example.test', alias: 'skydays2026' }],
    ]);
    expect(screen.getByLabelText('Kısa adres')).toHaveValue('skydays2026');
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
  });

  it('points the existing link somewhere new when only an external slot’s URL changed', async () => {
    const typist = userEvent.setup();
    listMine.mockResolvedValue([
      link({ id: 'u-old', alias: 'skydays2026', url: 'https://apply.example.test' }),
    ]);
    update.mockImplementation(async (id, body) => link({ id, ...body }));
    const { lastSlot } = renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply2.example.test',
      alias: 'skydays2026',
      saved: { alias: 'skydays2026', url: 'https://apply.example.test' },
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(update).toHaveBeenCalledWith('u-old', {
      url: 'https://apply2.example.test',
      alias: 'skydays2026',
    });
    expect(create).not.toHaveBeenCalled();
    expect(lastSlot()).toMatchObject({ alias: 'skydays2026', urlId: 'u-old' });
  });

  it('gives a slot switched to a Skyforms form the readable default alias', async () => {
    const typist = userEvent.setup();
    const { lastSlot } = renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply.example.test',
      alias: 'skydays',
      saved: { alias: 'skydays', url: 'https://apply.example.test' },
    });

    const address = screen.getByLabelText('Form adresi');
    await typist.clear(address);
    await typist.type(address, SKYFORMS_URL);
    await typist.tab();

    expect(await screen.findByText('Kısa link etkinlik kaydedilince oluşur')).toBeInTheDocument();
    expect(lastSlot()).toMatchObject({ url: SKYFORMS_URL, alias: 'gecekodu-skydays2026' });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a link for a new alias on an external slot', async () => {
    const typist = userEvent.setup();
    create.mockImplementation(async (body) => link(body));
    const { lastSlot } = renderSlot({
      ...emptyApplySlot(),
      url: 'https://apply.example.test',
      alias: 'skydays-final',
      saved: { alias: 'skydays2026', url: 'https://apply.example.test' },
    });

    await typist.click(screen.getByRole('button', CREATE_SHORT));

    expect(create).toHaveBeenCalledWith({
      url: 'https://apply.example.test',
      alias: 'skydays-final',
    });
    expect(lastSlot()).toMatchObject({ alias: 'skydays-final', urlId: 'u-new' });
  });

  describe('Skyforms alias availability', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function settle(ms = 400) {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    }

    it('only warns about a taken alias, which may be the form’s own link', async () => {
      const typist = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      availability.mockResolvedValue({ alias: 'gecekodu-kamp', available: false, reason: 'taken' });
      renderSlot({
        ...emptyApplySlot(),
        mode: 'skyforms',
        url: SKYFORMS_URL,
        alias: 'gecekodu-skydays2026',
        saved: { alias: 'gecekodu-skydays2026', url: SKYFORMS_URL },
      });
      await settle();
      expect(availability).not.toHaveBeenCalled();

      const alias = screen.getByLabelText('Kısa adres');
      await typist.clear(alias);
      await typist.type(alias, 'gecekodu.kamp');
      await settle();

      expect(availability).toHaveBeenLastCalledWith('gecekodu-kamp');
      expect(await screen.findByText(SKYFORMS_TAKEN)).toHaveClass('text-warning');
      expect(screen.getByRole('button', CREATE_SHORT)).toBeEnabled();
    });

    it('checks the default alias of a Skyforms slot whose field is empty', async () => {
      renderSlot({ ...emptyApplySlot(), mode: 'skyforms', url: SKYFORMS_URL });
      await settle();

      expect(availability).toHaveBeenCalledWith('gecekodu-skydays2026');
    });

    it('checks the saved alias again once the slot names a Skyforms form', async () => {
      const typist = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      availability.mockResolvedValue({
        alias: 'gecekodu-skydays2026',
        available: false,
        reason: 'taken',
      });
      renderSlot({
        ...emptyApplySlot(),
        url: 'https://apply.example.test',
        alias: 'gecekodu-skydays2026',
        saved: { alias: 'gecekodu-skydays2026', url: 'https://apply.example.test' },
      });

      const address = screen.getByLabelText('Form adresi');
      await typist.clear(address);
      await typist.type(address, SKYFORMS_URL);
      await settle();

      expect(availability).toHaveBeenLastCalledWith('gecekodu-skydays2026');
      expect(await screen.findByText(SKYFORMS_TAKEN)).toBeInTheDocument();
    });
  });
});
